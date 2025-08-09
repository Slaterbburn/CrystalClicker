import * as hz from 'horizon/core';
import { PlayerState, OnPlayerRebirth, OnRequestRebirthReset } from './Events';

export class RebirthManager extends hz.Component {
    // [FIXED] Restored the script property for easier balancing.
    static propsDefinition = {
        rebirthDarkMatterBaseCost: { type: hz.PropTypes.Number, default: 10 },
    };

    private readonly GAME_DATA_KEY = 'GemClickerData:ResourceRush_GameData';
    private readonly COST_INCREASE_MULTIPLIER = 1.7;

    start() {
        this.connectNetworkBroadcastEvent(OnPlayerRebirth, ({ player }) => {
            this.processRebirth(player);
        });
    }

    private getRebirthCost(rebirthCount: number): number {
        return Math.floor(this.props.rebirthDarkMatterBaseCost * Math.pow(this.COST_INCREASE_MULTIPLIER, rebirthCount));
    }

    private async processRebirth(player: hz.Player) {
        const state = await this.world.persistentStorage.getPlayerVariable<PlayerState>(player, this.GAME_DATA_KEY);
        if (!state) return;
        
        const currentRebirthCount = state.rebirth.rebirthCount || 0;
        const cost = this.getRebirthCost(currentRebirthCount);
        
        if (state.rebirth.darkMatter < cost) {
            return;
        }

        const darkMatterEarned = Math.floor(10 * Math.log10(state.rebirth.peakCPS || 1));

        state.rebirth.darkMatter -= cost;
        if (darkMatterEarned > 0) {
            state.rebirth.darkMatter += darkMatterEarned;
        }
        
        state.rebirth.peakCPS = 0;
        state.rebirth.rebirthCount = currentRebirthCount + 1;

        await this.world.persistentStorage.setPlayerVariable(player, this.GAME_DATA_KEY, state);

        this.sendLocalBroadcastEvent(OnRequestRebirthReset, { playerId: player.id });
    }
}
hz.Component.register(RebirthManager);
