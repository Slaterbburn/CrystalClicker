import * as hz from 'horizon/core';
import { PlayerState, OnClaimDailyReward, OnDailyRewardStateUpdate } from './Events';

export class DailyLoginManager extends hz.Component {
    static propsDefinition = {};
    
    private readonly GAME_DATA_KEY = 'GemClickerData:ResourceRush_GameData';

    start() {
        this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterWorld, (player: hz.Player) => {
            this.checkDailyLoginStatus(player);
        });
        
        this.connectNetworkBroadcastEvent(OnClaimDailyReward, ({ player }) => {
            this.handleClaimReward(player);
        });
    }

    private async checkDailyLoginStatus(player: hz.Player) {
        const state = await this.world.persistentStorage.getPlayerVariable<PlayerState>(player, this.GAME_DATA_KEY);
        if (!state) return;

        const now = new Date();
        const lastLogin = new Date(state.dailyLogin.lastLoginTimestamp || 0);
        
        const isNewDay = now.toDateString() !== lastLogin.toDateString();

        if (isNewDay) {
            this.sendNetworkEvent(player, OnDailyRewardStateUpdate, { canClaim: true, consecutiveDays: state.dailyLogin.consecutiveDays });
        } else {
            this.sendNetworkEvent(player, OnDailyRewardStateUpdate, { canClaim: false, consecutiveDays: state.dailyLogin.consecutiveDays });
        }
    }

    private async handleClaimReward(player: hz.Player) {
        const state = await this.world.persistentStorage.getPlayerVariable<PlayerState>(player, this.GAME_DATA_KEY);
        if (!state) return;
        
        const now = new Date();
        const lastLogin = new Date(state.dailyLogin.lastLoginTimestamp || 0);
        
        // Double-check if a new day has passed, in case of race conditions
        if (now.toDateString() === lastLogin.toDateString()) {
            return; // Already claimed today
        }

        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);

        if (lastLogin.toDateString() === yesterday.toDateString()) {
            state.dailyLogin.consecutiveDays++;
        } else {
            state.dailyLogin.consecutiveDays = 1; // Streak reset
        }
        
        if (state.dailyLogin.consecutiveDays > 7) {
            state.dailyLogin.consecutiveDays = 1; // Cycle back to day 1
        }
        
        console.log(`Player ${player.name.get()} claimed reward for day ${state.dailyLogin.consecutiveDays}.`);
        // In a full implementation, you'd add gems, boosts, etc., based on the day.
        state.crystalCount += 1000 * state.dailyLogin.consecutiveDays;

        state.dailyLogin.lastLoginTimestamp = now.getTime();
        await this.world.persistentStorage.setPlayerVariable(player, this.GAME_DATA_KEY, state);
        
        this.sendNetworkEvent(player, OnDailyRewardStateUpdate, { canClaim: false, consecutiveDays: state.dailyLogin.consecutiveDays });
    }
}
hz.Component.register(DailyLoginManager);
