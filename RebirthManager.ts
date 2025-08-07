import * as hz from 'horizon/core';
import { PlayerState, OnPlayerRebirth, OnRequestRebirthReset } from './Events';

export class RebirthManager extends hz.Component {
    static propsDefinition = {
        rebirthGemCost: { type: hz.PropTypes.Number, default: 1e15 }, // 1 Quadrillion
    };

    private readonly GAME_DATA_KEY = 'GemClickerData:ResourceRush_GameData';

    start() {
        this.connectNetworkBroadcastEvent(OnPlayerRebirth, ({ player }) => {
            this.processRebirth(player);
        });
    }

    private async processRebirth(player: hz.Player) {
        const state = await this.world.persistentStorage.getPlayerVariable<PlayerState>(player, this.GAME_DATA_KEY);
        if (!state || state.crystalCount < this.props.rebirthGemCost) {
            return;
        }

        // As per GDD, calculate Dark Matter based on Peak CPS.
        const darkMatterEarned = Math.floor(10 * Math.log10(state.rebirth.peakCPS || 1));

        if (darkMatterEarned > 0) {
            state.rebirth.darkMatter += darkMatterEarned;
        }
        
        state.rebirth.peakCPS = 0; // Reset peak for the next run

        await this.world.persistentStorage.setPlayerVariable(player, this.GAME_DATA_KEY, state);

        this.sendLocalBroadcastEvent(OnRequestRebirthReset, { playerId: player.id });
    }
}
hz.Component.register(RebirthManager);
