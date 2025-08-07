import * as hz from 'horizon/core';
import { PlayerState, OnShowOfflineProgress } from './Events';

export class OfflineProgressManager extends hz.Component {
    static propsDefinition = {
        maxOfflineHours: { type: hz.PropTypes.Number, default: 2 },
    };

    private readonly GAME_DATA_KEY = 'GemClickerData:ResourceRush_GameData';
    private readonly STATIC_DATA_KEY = 'GemClickerData:StaticData'; // Assuming DataManager is updated to use this

    start() {
        this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterWorld, (player: hz.Player) => {
            this.calculateOfflineProgress(player);
        });
    }

    private async calculateOfflineProgress(player: hz.Player) {
        const state = await this.world.persistentStorage.getPlayerVariable<PlayerState>(player, this.GAME_DATA_KEY);

        if (!state || !state.lastUpdateTimestamp || state.lastUpdateTimestamp === 0) {
            return;
        }

        const now = Date.now();
        const timeOfflineMs = now - state.lastUpdateTimestamp;
        const maxOfflineMs = this.props.maxOfflineHours * 60 * 60 * 1000;
        const effectiveTimeMs = Math.min(timeOfflineMs, maxOfflineMs);

        if (effectiveTimeMs < 60000) {
            return;
        }

        const totalProduction = state.generators.reduce((total, gen) => {
            // NOTE: This calculation is simplified. A full implementation would need
            // to fetch milestone data to calculate the true GPS. For now, this is a close approximation.
            return total + (gen.owned * gen.productionRate);
        }, 0);
        
        const darkMatterBonus = 1 + (state.rebirth.darkMatter * 0.02);
        const finalGPS = totalProduction * darkMatterBonus;
        
        const gemsEarned = Math.floor(finalGPS * (effectiveTimeMs / 1000));
        
        if (gemsEarned > 0) {
            state.crystalCount += gemsEarned;
            
            await this.world.persistentStorage.setPlayerVariable(player, this.GAME_DATA_KEY, state);
            
            this.sendNetworkEvent(player, OnShowOfflineProgress, { 
                crystalsEarned: gemsEarned,
                durationSeconds: Math.floor(effectiveTimeMs / 1000)
            });
        }
    }
}
hz.Component.register(OfflineProgressManager);
