// GameUI.ts

import * as hz from 'horizon/core'
import { Color } from 'horizon/core'
import {
  UIComponent, View, Text, Pressable, Binding, UINode,
  DynamicList, Image, ImageSource, ScrollView, AnimatedBinding, Animation, Easing
} from 'horizon/ui'
import {
  Generator, QuestDisplayData, OnUpdatePlayerState, OnManualDrill, OnBuyGenerator, ClickMilestone, OnGemCountUpdate
} from './Events'

export class GameUI extends UIComponent<typeof GameUI> {
  static propsDefinition = {
    BackgroundImage: { type: hz.PropTypes.Asset },
    DiamondIcon: { type: hz.PropTypes.Asset },
  }

  // --- BINDINGS ---
  private readonly gemCountBinding = new Binding(0)
  private readonly generatorsBinding = new Binding<Generator[]>([])
  private readonly currentQuestBinding = new Binding<QuestDisplayData>({ id: 0, description: "Loading Quest..." })
  private readonly currentScreenBinding = new Binding<'menu' | 'game'>('menu')
  private readonly diamondScaleBinding = new AnimatedBinding(1);
  private readonly gemsPerClickBinding = new Binding(1);
  private readonly nextClickMilestoneBinding = new Binding<ClickMilestone | null>(null);
  private readonly totalGPSBinding = new Binding(0);
  private readonly depthBinding = new Binding(0);

  // --- PRIVATE CLASS VARIABLES ---
  private gemsPerClick = 1;
  private gemCount = 0;
  // [NEW] Flag to prevent animation spamming
  private gemAnimationInProgress = false;

  start() {
    const localPlayer = this.world.getLocalPlayer()
    if (localPlayer && localPlayer !== this.world.getServerPlayer()) {
      localPlayer.enterFocusedInteractionMode()
      hz.PlayerControls.disableSystemControls()
    }
    
    this.connectNetworkEvent(
        this.world.getLocalPlayer(),
        OnUpdatePlayerState,
        (data) => {
          this.gemCount = data.gemCount;
          this.gemsPerClick = data.gemsPerClick;
          
          this.gemCountBinding.set(data.gemCount)
          this.generatorsBinding.set(data.generators)
          this.currentQuestBinding.set(data.currentQuest)
          this.gemsPerClickBinding.set(data.gemsPerClick)
          this.nextClickMilestoneBinding.set(data.nextClickMilestone);
          this.totalGPSBinding.set(data.totalGPS);
          this.depthBinding.set(data.depth);
        },
    );

    this.connectNetworkEvent(
        this.world.getLocalPlayer(),
        OnGemCountUpdate,
        (data) => {
            this.gemCount = data.gemCount;
            this.gemCountBinding.set(data.gemCount);
            this.totalGPSBinding.set(data.totalGPS);
        }
    );
  }

  initializeUI(): UINode {
    const mainView = UINode.if(
      this.currentScreenBinding.derive(s => s === 'menu'),
      this.renderMenuScreen(),
      this.renderGameScreen(),
    )
    const children: UINode[] = [];
    if (this.props.BackgroundImage) {
        children.push(Image({
            source: ImageSource.fromTextureAsset(this.props.BackgroundImage.as(hz.TextureAsset)),
            style: { position: 'absolute', width: '100%', height: '100%' },
        }));
    }
    children.push(View({
      style: { position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    }));
    children.push(mainView);
    return View({ style: { width: '100%', height: '100%' }, children: children });
  }

  private formatCompactNumber(value: number): string {
    const num = Math.floor(value);
    if (num >= 1e12) return (num / 1e12).toFixed(2).replace(/\.00$/, '') + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2).replace(/\.00$/, '') + 'K';
    return num.toString();
  }

  private renderMenuScreen(): UINode {
    return View({
      style: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
      children: [
        Text({ text: 'Gem Clicker', style: { color: 'white', fontSize: 80, marginBottom: 10, textShadowColor: '#000000', textShadowOffset: [3, 3] } }),
        Text({ text: 'Click to get rich!', style: { color: 'white', fontSize: 24, marginBottom: 40, textShadowColor: '#000000', textShadowOffset: [2, 2] } }),
        Pressable({
          onClick: () => this.currentScreenBinding.set('game'),
          children: [Text({ text: 'Play Game', style: { color: 'white', fontSize: 32 } })],
          style: { backgroundColor: '#34A853', padding: 25, borderRadius: 15, borderWidth: 2, borderColor: '#FFFFFF' }
        })
      ]
    });
  }

  private renderGameScreen(): UINode {
    return View({
      style: { width: '100%', height: '100%', flexDirection: 'row', padding: 20 },
      children: [
        this.renderClickerPanel(),
        this.renderStoreAndQuestPanel(),
      ],
    })
  }

  private renderClickerPanel(): UINode {
    const mineButtonText = this.gemsPerClickBinding.derive(gpc => `Mine ${gpc} Gem${gpc > 1 ? 's' : ''}`);
    let clickerContent: UINode;
    if (this.props.DiamondIcon) {
        clickerContent = Image({
             source: ImageSource.fromTextureAsset(this.props.DiamondIcon.as(hz.TextureAsset)),
            style: { width: 256, height: 256 }
        });
    } else {
        clickerContent = View({
            children: [Text({ text: mineButtonText, style: { color: 'white', fontSize: 24 } })],
            style: { backgroundColor: '#4A90E2', padding: 20, borderRadius: 10, borderWidth: 2, borderColor: '#FFFFFF' },
        });
    }
    
    return View({
      style: { flex: 2, justifyContent: 'center', alignItems: 'center', padding: 10, marginRight: 10 },
      children: [
        View({
          style: {
            width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: 10,
            justifyContent: 'center', alignItems: 'center', position: 'relative'
         },
          children: [
            Pressable({
              // [REMOVED] onPress and onRelease are removed to prevent animation conflicts.
              // [MODIFIED] onClick now handles the entire animation sequence.
              onClick: (player) => {
                // Instantly update the gem count for responsiveness
                this.gemCount += this.gemsPerClick;
                this.gemCountBinding.set(this.gemCount);
                
                // Notify the server about the click
                this.sendNetworkBroadcastEvent(OnManualDrill, { player });

                // Check if an animation is already playing to prevent spamming
                if (this.gemAnimationInProgress) return;

                // Set the flag to true
                this.gemAnimationInProgress = true;

                // Create a single, self-contained "bop" animation
                const clickAnimation = Animation.sequence(
                    Animation.timing(0.9, { duration: 75 }),
                    Animation.timing(1.0, { duration: 75 })
                );

                // Play the animation and use the onEnd callback to reset the flag
                this.diamondScaleBinding.set(clickAnimation, () => {
                    this.gemAnimationInProgress = false;
                });
              },
              style: { transform: [{ scale: this.diamondScaleBinding }], zIndex: 10, marginBottom: 20, },
              children: [clickerContent],
            }),
            Text({
              text: this.gemCountBinding.derive(count => `Gems: ${this.formatCompactNumber(count)}`),
              style: { color: 'white', fontSize: 60, textShadowColor: '#000000', textShadowOffset: [2, 2] },
            }),
            View({
              style: { flexDirection: 'row', marginTop: 10 },
              children: [
                Text({
                  text: this.totalGPSBinding.derive(gps => `GPS: ${this.formatCompactNumber(gps)}`),
                  style: { color: '#B2F3FF', fontSize: 22, textShadowColor: '#000000', textShadowOffset: [1, 1], marginRight: 15 },
                }),
                Text({
                  text: this.depthBinding.derive(d => `Depth: ${this.formatCompactNumber(d)}m`),
                  style: { color: '#B2F3FF', fontSize: 22, textShadowColor: '#000000', textShadowOffset: [1, 1], marginLeft: 15 },
                }),
              ]
            }),
            Text({
              text: this.nextClickMilestoneBinding.derive(milestone => {
                if (milestone) {
                  return `Next Upgrade at ${this.formatCompactNumber(milestone.clicks)} Clicks: ${milestone.gemsPerClick} Gems per Click!`;
                }
                return "Click Power Maxed Out!";
              }),
              style: { color: '#FFD700', fontSize: 18, marginTop: 10 }
            })
          ]
        })
      ],
    })
  }

  private renderStoreAndQuestPanel(): UINode {
    return View({
      style: { flex: 1.5, flexDirection: 'column', padding: 10, marginLeft: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10 },
      children: [
        Text({ text: 'Generator Bay', style: { color: 'white', fontSize: 36, marginBottom: 10 } }),
        ScrollView({
          style: { flex: 1 },
          children: DynamicList({
            data: this.generatorsBinding,
            renderItem: (item: Generator) => this.renderGeneratorItem(item),
          }),
        }),
        Text({ text: 'Current Quest', style: { color: 'white', fontSize: 36, marginTop: 20, marginBottom: 10 } }),
        this.renderCurrentQuest(),
      ],
    })
  }

  private renderGeneratorItem(item: Generator): UINode {
    return View({
      style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 5, marginBottom: 10 },
      children: [
        View({
          style: { flex: 1 },
          children: [
            Text({ text: item.name, style: { color: 'white', fontSize: 20 } }),
            Text({ text: `Cost: ${this.formatCompactNumber(item.currentCost)} Gems`, style: { color: '#CCCCCC', fontSize: 14 } }),
            Text({ text: `+${this.formatCompactNumber(item.productionRate)} GPS`, style: { color: '#CCCCCC', fontSize: 14 } }),
            UINode.if(
              item.nextMilestone !== undefined,
              Text({ text: `Next bonus at ${item.nextMilestone?.owned}: x${item.nextMilestone?.multiplier} Production!`, style: { color: '#FFD700', fontSize: 14, marginTop: 4 } })
            )
          ],
        }),
        View({
          style: { alignItems: 'center' },
          children: [
            Text({ text: `Owned: ${item.owned}`, style: { color: 'white', fontSize: 20 } }),
            Pressable({
              disabled: this.gemCountBinding.derive(gems => gems < item.currentCost),
              onClick: (player) => this.sendNetworkBroadcastEvent(OnBuyGenerator, { player, generatorId: item.id }),
              children: [Text({ text: 'Buy', style: { color: 'white', fontSize: 18 } })],
              style: {
                backgroundColor: this.gemCountBinding.derive(gems =>
                   gems >= item.currentCost ? '#34A853' : '#555555'
                ),
                padding: 10, borderRadius: 5
             },
            }),
          ]
        })
      ],
    })
  }

  private renderCurrentQuest(): UINode {
    return View({
      style: { padding: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 5, minHeight: 60, justifyContent: 'center' },
      children: [
        Text({
          text: this.currentQuestBinding.derive(quest => quest ? quest.description : "All Quests Complete!"),
          style: {
            color: this.currentQuestBinding.derive(quest => quest ? 'white' : '#AAAAAA'),
            fontSize: 18,
          }
        })
      ]
    })
  }
}

UIComponent.register(GameUI);
