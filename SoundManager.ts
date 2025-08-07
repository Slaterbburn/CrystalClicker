import * as hz from 'horizon/core';
import { OnManualDrill, OnBuyGenerator, OnQuestCompleted, OnGeneratorMilestoneReached } from './Events';

export class SoundManager extends hz.Component {
    static propsDefinition = {
        // Drag the actual Audio Gizmo entities from your scene into these properties.
        ClickSound: { type: hz.PropTypes.Entity },
        BuyUpgradeSound: { type: hz.PropTypes.Entity },
        QuestCompleteSound: { type: hz.PropTypes.Entity },
        MilestoneSound: { type: hz.PropTypes.Entity },
        AmbientMusic: { type: hz.PropTypes.Entity },
    };

    start() {
        // This should be a server-owned script to hear events from all players.
        this.connectNetworkBroadcastEvent(OnManualDrill, () => this.playSound(this.props.ClickSound));
        this.connectNetworkBroadcastEvent(OnBuyGenerator, () => this.playSound(this.props.BuyUpgradeSound));
        this.connectNetworkBroadcastEvent(OnQuestCompleted, () => this.playSound(this.props.QuestCompleteSound));
        this.connectNetworkBroadcastEvent(OnGeneratorMilestoneReached, () => this.playSound(this.props.MilestoneSound));

        // Start the ambient music on a loop when the world begins.
        this.playSound(this.props.AmbientMusic);
    }

    private playSound(soundEntity: hz.Entity | null) {
        if (soundEntity) {
            soundEntity.as(hz.AudioGizmo).play();
        }
    }
}
hz.Component.register(SoundManager);
