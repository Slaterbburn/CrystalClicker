// UI_ImagePreloader.ts

import * as hz from 'horizon/core';
import { UIComponent, UINode, Image, ImageSource, Binding } from 'horizon/ui';
import { onImagesReady } from './Events';

export class UI_ImagePreloader extends UIComponent {
    static propsDefinition = {
        Backgrounds: { type: hz.PropTypes.AssetArray },
        GemIcons: { type: hz.PropTypes.AssetArray },
        // Add more AssetArray props here as we create more icons
        // ShopItemIcons: { type: hz.PropTypes.AssetArray },
        // DailyRewardIcons: { type: hz.PropTypes.AssetArray },
    };

    private loadedImageBinding = new Binding<ImageSource>(new ImageSource());
    private allImages: hz.Asset[] = [];

    start() {
        // Collect all assets from props into a single array
        this.allImages = [
            ...(this.props.Backgrounds || []),
            ...(this.props.GemIcons || []),
        ];

        // This component runs locally for each player. 
        // We only need to preload once, so we'll have the server player do it.
        if (this.world.getLocalPlayer() === this.world.getServerPlayer()) {
            this.preloadImages();
        }
    }

    private preloadImages() {
        if (this.allImages.length === 0) {
            console.log("ImagePreloader: No images to preload. Broadcasting ready signal.");
            this.sendNetworkBroadcastEvent(onImagesReady, {});
            return;
        }

        let index = 0;
        const intervalId = this.async.setInterval(() => {
            if (index >= this.allImages.length) {
                this.async.clearInterval(intervalId);
                console.log("ImagePreloader: Preloading complete. Broadcasting ready signal.");
                this.sendNetworkBroadcastEvent(onImagesReady, {});
                return;
            }

            const asset = this.allImages[index];
            if (asset) {
                this.loadedImageBinding.set(ImageSource.fromTextureAsset(asset.as(hz.TextureAsset)));
            }
            index++;
        }, 100); // Load one image every 100ms
    }

    initializeUI(): UINode {
        // Render a single, tiny, invisible image off-screen.
        // We just need an Image component to assign the source to.
        return Image({
            source: this.loadedImageBinding,
            style: { width: 1, height: 1, position: 'absolute' },
        });
    }
}
UIComponent.register(UI_ImagePreloader);
