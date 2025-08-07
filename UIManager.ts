import * as hz from 'horizon/core';
import { 
    onImagesReady, 
    onUIReadyForRegistration,
    sendUIUpdate,
    spawnUIForPlayer,
    cleanupUIForPlayer,
} from './Events';

export class UIManager extends hz.Component {
    static propsDefinition = {
        GameUIAsset: { type: hz.PropTypes.Asset },
        ImagePreloaderAsset: { type: hz.PropTypes.Asset },
    };

    private imagesReady = false;
    private pendingSpawnQueue: hz.Player[] = [];
    private playerUIEntities: Map<number, hz.Entity[]> = new Map();

    start() {
        this.connectNetworkBroadcastEvent(onImagesReady, () => {
            this.imagesReady = true;
            console.log('UIManager: All images are preloaded and ready.');
            for (const player of this.pendingSpawnQueue) {
                this.spawnAllUIForPlayer(player);
            }
            this.pendingSpawnQueue = [];
        });

        this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterWorld, (player: hz.Player) => {
            this.handlePlayerEnter(player);
        });

        this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerExitWorld, (player: hz.Player) => {
            this.cleanupUIForPlayer(player);
        });
    }

    private handlePlayerEnter(player: hz.Player) {
        if (this.imagesReady) {
            this.spawnAllUIForPlayer(player);
        } else {
            console.log(`UIManager: Images not ready, queueing UI spawn for ${player.name.get()}`);
            this.pendingSpawnQueue.push(player);
        }
    }

    private async spawnAllUIForPlayer(player: hz.Player) {
        console.log(`UIManager: Spawning all UI for ${player.name.get()}`);
        if (!this.playerUIEntities.has(player.id)) {
            this.playerUIEntities.set(player.id, []);
        }

        // Spawn the main GameUI
        if (this.props.GameUIAsset) {
            const [uiEntity] = await this.world.spawnAsset(this.props.GameUIAsset, new hz.Vec3(0, 0, 0));
            if (uiEntity) {
                uiEntity.owner.set(player);
                this.playerUIEntities.get(player.id)?.push(uiEntity);
            }
        }

        // Spawn the preloader (which is just an invisible UI to hold textures)
        if (this.props.ImagePreloaderAsset) {
            const [preloaderEntity] = await this.world.spawnAsset(this.props.ImagePreloaderAsset, new hz.Vec3(0, -100, 0)); // Spawn it out of sight
             if (preloaderEntity) {
                preloaderEntity.owner.set(player);
                this.playerUIEntities.get(player.id)?.push(preloaderEntity);
            }
        }
    }

    private async cleanupUIForPlayer(player: hz.Player) {
        const entities = this.playerUIEntities.get(player.id);
        if (entities) {
            console.log(`UIManager: Cleaning up ${entities.length} UI entities for ${player.name.get()}`);
            for (const entity of entities) {
                if (entity.exists()) {
                    await this.world.deleteAsset(entity, true);
                }
            }
            this.playerUIEntities.delete(player.id);
        }
    }
}
hz.Component.register(UIManager);
