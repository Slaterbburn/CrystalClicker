import * as hz from 'horizon/core';
import { UIComponent, UINode, Image, ImageSource, Binding } from 'horizon/ui';
import { onImagesReady } from './Events';

export class UI_ImagePreloader extends UIComponent {
    static propsDefinition = {
        Backgrounds: { type: hz.PropTypes.AssetArray },
        GemIcons: { type: hz.PropTypes.AssetArray },
    };

    private loadedImageBinding = new Binding<ImageSource>(new ImageSource());
    
    start() {
        // This component should be on a server-owned entity.
        // The server will handle preloading for everyone.
        if (this.world.getLocalPlayer() === this.world.getServerPlayer()) {
            this.preloadImages();
        }
    }

    private preloadImages() {
        const allImages: hz.Asset[] = [
            ...(this.props.Backgrounds || []),
            ...(this.props.GemIcons || []),
        ];

        if (allImages.length === 0) {
            console.log("ImagePreloader: No images to preload. Broadcasting ready signal.");
            this.sendNetworkBroadcastEvent(onImagesReady, {});
            return;
        }

        let index = 0;
        // Load one image every 100ms to spread the load and prevent a hitch on world start.
        const intervalId = this.async.setInterval(() => {
            if (index >= allImages.length) {
                this.async.clearInterval(intervalId);
                console.log("ImagePreloader: Preloading complete. Broadcasting ready signal.");
                this.sendNetworkBroadcastEvent(onImagesReady, {});
                return;
            }

            const asset = allImages[index];
            if (asset) {
                this.loadedImageBinding.set(ImageSource.fromTextureAsset(asset.as(hz.TextureAsset)));
            }
            index++;
        }, 100);
    }

    initializeUI(): UINode {
        // Render a single, tiny, invisible image. We just need an Image component 
        // in the UI tree so we can assign our asset to its `source` to trigger the load.
        return Image({
            source: this.loadedImageBinding,
            style: { width: 1, height: 1, position: 'absolute', left: -10, top: -10 },
        });
    }
}
UIComponent.register(UI_ImagePreloader);
