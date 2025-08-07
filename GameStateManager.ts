import * as hz from 'horizon/core'
import {
  Generator, OnBuyGenerator, OnManualDrill, OnStaticDataLoaded, OnUpdatePlayerState,
  QuestDefinition, QuestState, QuestDisplayData, PlayerState, ClickMilestone, Milestone
} from './Events'

type MetaData = {
  saveVersion: number
}

export class GameStateManager extends hz.Component<typeof GameStateManager> {
  static propsDefinition = {
    saveVersion: { type: hz.PropTypes.Number, default: 1 },
  }

  private players = new Map<number, PlayerState>()
  private staticData: {
    generators: Generator[]
    quests: QuestDefinition[]
    milestones: Milestone[]
    clickMilestones: ClickMilestone[]
  } | null = null

  private readonly META_DATA_KEY = 'ResourceRush_MetaData'
  private readonly GAME_DATA_KEY = 'ResourceRush_GameData'

  preStart() {
    this.connectLocalBroadcastEvent(OnStaticDataLoaded, (data) => {
        this.staticData = data;
    });
  }

  start() {
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterWorld, (player) => this.onPlayerJoined(player));
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerExitWorld, (player) => this.onPlayerLeft(player));
    this.connectNetworkBroadcastEvent(OnManualDrill, ({ player }) => this.handleManualDrill(player));
    this.connectNetworkBroadcastEvent(OnBuyGenerator, ({ player, generatorId }) => this.handleBuyGenerator(player, generatorId));
    this.async.setInterval(() => this.gameTick(), 1000);
  }

  private async onPlayerJoined(player: hz.Player) {
    if (!this.staticData) {
      this.async.setTimeout(() => this.onPlayerJoined(player), 100);
      return;
    }

    const metaData = await this.world.persistentStorage.getPlayerVariable<MetaData>(player, this.META_DATA_KEY);
    let newState: PlayerState;

    if (metaData && metaData.saveVersion === this.props.saveVersion) {
      const gameData = await this.world.persistentStorage.getPlayerVariable<PlayerState>(player, this.GAME_DATA_KEY);
      newState = gameData || this.createNewPlayerData();
    } else {
      newState = this.createNewPlayerData();
      await this.savePlayer(player, newState);
    }
    
    if (newState.totalManualClicks === undefined) {
        newState.totalManualClicks = 0;
    }

    this.players.set(player.id, newState);
    this.updatePlayerUI(player);
  }

  private onPlayerLeft(player: hz.Player) {
    this.savePlayer(player);
    this.players.delete(player.id);
  }
  
  private createNewPlayerData(): PlayerState {
    if (!this.staticData) return { gemCount: 0, totalManualClicks: 0, generators: [], quests: [] };

    return {
      gemCount: 0,
      totalManualClicks: 0,
      generators: JSON.parse(JSON.stringify(this.staticData.generators)),
      quests: this.staticData.quests.map((def) => ({ id: def.id, isComplete: false })),
    };
  }

  private calculateGeneratorGPS(generator: Generator): number {
    let finalMultiplier = 1;
    if (!this.staticData) return generator.owned * generator.productionRate;

    for (let i = this.staticData.milestones.length - 1; i >= 0; i--) {
        const milestone = this.staticData.milestones[i];
        if (generator.owned >= milestone.owned) {
            finalMultiplier = milestone.multiplier;
            break;
        }
    }
    return generator.owned * generator.productionRate * finalMultiplier;
  }

  private calculateGemsPerClick(state: PlayerState): number {
    let gems = 1;
    if (!this.staticData) return gems;

    for (let i = this.staticData.clickMilestones.length - 1; i >= 0; i--) {
        const milestone = this.staticData.clickMilestones[i];
        if (state.totalManualClicks >= milestone.clicks) {
            gems = milestone.gemsPerClick;
            break;
        }
    }
    return gems;
  }

  private gameTick() {
    this.players.forEach((state, playerId) => {
      let totalProduction = 0;
      state.generators.forEach(gen => { totalProduction += this.calculateGeneratorGPS(gen); });
      
      if (totalProduction > 0) {
        state.gemCount += totalProduction;
        this.checkQuests(state);
        
        const player = this.world.getPlayers().find(p => p.id === playerId);
        if (player) {
          this.savePlayer(player, state);
          this.updatePlayerUI(player, state);
        }
      }
    });
  }

  private handleManualDrill(player: hz.Player) {
    const state = this.players.get(player.id);
    if (state) {
      const gemsToAdd = this.calculateGemsPerClick(state);
      state.gemCount += gemsToAdd;
      state.totalManualClicks++;
      this.checkQuests(state);
      this.savePlayer(player, state);
      this.updatePlayerUI(player, state);
    }
  }
  
  private handleBuyGenerator(player: hz.Player, generatorId: number) {
    const state = this.players.get(player.id);
    if (state) {
      const generator = state.generators.find((g) => g.id === generatorId);
      if (generator && state.gemCount >= generator.currentCost) {
        state.gemCount -= generator.currentCost;
        generator.owned++;
        generator.currentCost = Math.floor(generator.baseCost * Math.pow(1.15, generator.owned));
        this.checkQuests(state);
        this.savePlayer(player, state);
        this.updatePlayerUI(player, state);
      }
    }
  }

  private checkQuests(state: PlayerState) {
    if (!this.staticData) return;
    state.quests.forEach((questState) => {
      if (!questState.isComplete) {
        const definition = this.staticData!.quests.find(def => def.id === questState.id);
        if (definition && definition.checkCondition(state.gemCount, state.generators)) {
          questState.isComplete = true;
        }
      }
    });
  }
  
  private updatePlayerUI(player: hz.Player, state?: PlayerState) {
    const currentState = state || this.players.get(player.id);
    if (!currentState || !this.staticData) return;
  
    const firstIncompleteQuestState = currentState.quests.find((q) => !q.isComplete);
    let currentQuestForUI: QuestDisplayData = null;
    if (firstIncompleteQuestState) {
      const questDef = this.staticData.quests.find(def => def.id === firstIncompleteQuestState.id);
      if (questDef) {
        currentQuestForUI = { id: questDef.id, description: questDef.description };
      }
    }

    const generatorsForUI = currentState.generators.map(gen => {
        const nextMilestone = this.staticData!.milestones.find(m => gen.owned < m.owned);
        return { ...gen, nextMilestone: nextMilestone };
    });

    const nextClickMilestone = this.staticData.clickMilestones.find(m => currentState.totalManualClicks < m.clicks) || null;
  
    this.sendNetworkEvent(player, OnUpdatePlayerState, {
      gemCount: currentState.gemCount,
      generators: generatorsForUI,
      currentQuest: currentQuestForUI,
      gemsPerClick: this.calculateGemsPerClick(currentState),
      nextClickMilestone: nextClickMilestone,
    });
  }

  private savePlayer(player: hz.Player, state?: PlayerState) {
    const stateToSave = state || this.players.get(player.id);
    if (!stateToSave) return;

    const metaData: MetaData = { saveVersion: this.props.saveVersion };
    this.world.persistentStorage.setPlayerVariable(player, this.META_DATA_KEY, metaData);
    this.world.persistentStorage.setPlayerVariable(player, this.GAME_DATA_KEY, stateToSave);
  }
}

hz.Component.register(GameStateManager)
