// GameStateManager.ts

import * as hz from 'horizon/core';
import {
  Generator, OnBuyGenerator, OnManualDrill, OnStaticDataLoaded, OnUpdatePlayerState,
  QuestDefinition, QuestState, QuestDisplayData, PlayerState, ClickMilestone, Milestone,
  OnGemCountUpdate // Import the new event
} from './Events';

type MetaData = {
  saveVersion: number
}

export class GameStateManager extends hz.Component<typeof GameStateManager> {
  static propsDefinition = {
    saveVersion: { type: hz.PropTypes.Number, default: 1 },
    forceResetPlayerSave: { type: hz.PropTypes.Boolean, default: false },
    // [NEW] Added configurable auto-save interval as requested
    autoSaveIntervalSecs: { type: hz.PropTypes.Number, default: 30 },
  }

  private players = new Map<number, PlayerState>();
  private staticData: {
    generators: Generator[];
    quests: QuestDefinition[];
    milestones: Milestone[];
    clickMilestones: ClickMilestone[];
  } | null = null;

  private readonly META_DATA_KEY = 'GemClickerData:ResourceRush_MetaData';
  private readonly GAME_DATA_KEY = 'GemClickerData:ResourceRush_GameData';

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
    
    const saveInterval = this.props.autoSaveIntervalSecs > 0 ? this.props.autoSaveIntervalSecs : 30;
    this.async.setInterval(() => {
        this.players.forEach((state, playerId) => {
            const player = this.world.getPlayers().find(p => p.id === playerId);
            if(player) {
                this.savePlayer(player, state);
            }
        });
    }, saveInterval * 1000);

    this.async.setInterval(() => this.gameTick(), 1000);
  }

  // onPlayerJoined logic remains the same
  private async onPlayerJoined(player: hz.Player) {
    if (!this.staticData) {
      this.async.setTimeout(() => this.onPlayerJoined(player), 100);
      return;
    }
    if (this.props.forceResetPlayerSave) {
        console.log(`GameStateManager: FORCE RESETTING SAVE DATA for player ${player.name.get()}`);
        const newState = this.createNewPlayerData();
        this.players.set(player.id, newState);
        await this.savePlayer(player, newState);
        this.updatePlayerUI(player);
        return;
    }
    const metaData = await this.world.persistentStorage.getPlayerVariable<MetaData>(player, this.META_DATA_KEY);
    const gameData = await this.world.persistentStorage.getPlayerVariable<PlayerState>(player, this.GAME_DATA_KEY);
    if (metaData && metaData.saveVersion === this.props.saveVersion && gameData) {
        const loadedState = this.createNewPlayerData();
        loadedState.gemCount = gameData.gemCount || 0;
        loadedState.totalManualClicks = gameData.totalManualClicks || 0;
        loadedState.depth = gameData.depth || 0;
        if (gameData.generators && gameData.generators.length === loadedState.generators.length) {
            loadedState.generators = gameData.generators;
        }
        if (gameData.quests && gameData.quests.length === loadedState.quests.length) {
            loadedState.quests = gameData.quests;
        }
        this.players.set(player.id, loadedState);
    } else {
        const newState = this.createNewPlayerData();
        this.players.set(player.id, newState);
        await this.savePlayer(player, newState);
    }
    this.updatePlayerUI(player);
  }

  // onPlayerLeft logic remains the same
  private onPlayerLeft(player: hz.Player) {
    console.log(`GameStateManager: Player ${player.name.get()} is leaving. Saving final data.`);
    this.savePlayer(player);
    this.players.delete(player.id);
  }

  // createNewPlayerData logic remains the same
  private createNewPlayerData(): PlayerState {
    if (!this.staticData) return { gemCount: 0, totalManualClicks: 0, depth: 0, generators: [], quests: [] };
    return {
      gemCount: 0,
      totalManualClicks: 0,
      depth: 0,
      generators: JSON.parse(JSON.stringify(this.staticData.generators)),
      quests: this.staticData.quests.map((def) => ({ id: def.id, isComplete: false })),
    };
  }
  
  // calculateGeneratorGPS logic remains the same
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

  // calculateGemsPerClick logic remains the same
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
      const totalProduction = state.generators.reduce((total, gen) => total + this.calculateGeneratorGPS(gen), 0);
      
      if (totalProduction > 0) {
        state.gemCount += totalProduction;
        this.checkQuests(state, playerId);
        
        const player = this.world.getPlayers().find(p => p.id === playerId);
        if (player) {
          // [MODIFIED] Send the lightweight update instead of the full UI update.
          this.sendNetworkEvent(player, OnGemCountUpdate, {
            gemCount: state.gemCount,
            totalGPS: totalProduction
          });
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
      state.depth++;
      this.checkQuests(state, player.id);
      // Send a full UI update on click because milestones might have changed.
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
        this.checkQuests(state, player.id);
        this.savePlayer(player, state);
        // Send a full UI update because the generator list has changed.
        this.updatePlayerUI(player, state);
      }
    }
  }

  // checkQuests logic remains the same
  private checkQuests(state: PlayerState, playerId: number) {
    if (!this.staticData) return;
    state.quests.forEach((questState) => {
      if (!questState.isComplete) {
        const definition = this.staticData!.quests.find(def => def.id === questState.id);
        if (definition && definition.checkCondition(state.gemCount, state.generators)) {
          questState.isComplete = true;
          const player = this.world.getPlayers().find(p => p.id === playerId);
          if(player) {
            player.setAchievementComplete(definition.id.toString(), true);
          }
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
    
    const totalGPS = currentState.generators.reduce((total, gen) => total + this.calculateGeneratorGPS(gen), 0);
    
    this.sendNetworkEvent(player, OnUpdatePlayerState, {
      gemCount: currentState.gemCount,
      generators: generatorsForUI,
      currentQuest: currentQuestForUI,
      gemsPerClick: this.calculateGemsPerClick(currentState),
      nextClickMilestone: nextClickMilestone,
      totalGPS: totalGPS,
      depth: currentState.depth,
    });
  }

  // savePlayer logic remains the same
  private async savePlayer(player: hz.Player, state?: PlayerState) {
    const stateToSave = state || this.players.get(player.id);
    if (!stateToSave) return;
    
    const metaData: MetaData = { saveVersion: this.props.saveVersion };

    await this.world.persistentStorage.setPlayerVariable(player, this.META_DATA_KEY, metaData);
    await this.world.persistentStorage.setPlayerVariable(player, this.GAME_DATA_KEY, stateToSave);
  }
}

hz.Component.register(GameStateManager);
