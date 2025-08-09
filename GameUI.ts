import * as hz from 'horizon/core'
import { Color } from 'horizon/core' 
import {
  UIComponent, View, Text, Pressable, Binding, UINode,
  DynamicList, Image, ImageSource, ScrollView, AnimatedBinding, Animation, Easing, ViewStyle
} from 'horizon/ui'
import {
  Generator, QuestDisplayData, OnUpdatePlayerState, OnManualDrill, OnBuyGenerator, ClickMilestone,
  OnGemCountUpdate, RebirthState, OnPlayerRebirth,
  OnShowOfflineProgress
} from './Events'

type FloatingNumberState = {
    textBinding: Binding<string>;
    yBinding: AnimatedBinding;
    opacityBinding: AnimatedBinding;
    visibleBinding: Binding<boolean>;
};

type RightPanelTab = 'Generators' | 'Rebirth';

export class GameUI extends UIComponent<typeof GameUI> {
  static propsDefinition = {
    BackgroundImage: { type: hz.PropTypes.Asset },
    DiamondIcon: { type: hz.PropTypes.Asset },
    GeneratorIcon: { type: hz.PropTypes.Asset },
    RebirthIcon: { type: hz.PropTypes.Asset },
  }
  
  // [FIXED] Use a private variable to track visibility state instead of .get()
  private isVisible: boolean = false;
  private isVisibleBinding = new Binding(false); // Hidden by default.

  private readonly rightPanelTabBinding = new Binding<RightPanelTab>('Generators');
  private readonly crystalCountBinding = new Binding(0)
  private readonly crystalsPerClickBinding = new Binding(1);
  private readonly generatorsBinding = new Binding<Generator[]>([])
  private readonly currentQuestBinding = new Binding<QuestDisplayData>({id: 0, description: "Loading Quest..."})
  private readonly diamondScaleBinding = new AnimatedBinding(1);
  private readonly nextClickMilestoneBinding = new Binding<ClickMilestone | null>(null);
  private readonly totalGPSBinding = new Binding(0);
  private readonly depthBinding = new Binding(0);
  private readonly rebirthStateBinding = new Binding<RebirthState>({ darkMatter: 0, peakCPS: 0, rebirthCount: 0 });
  private readonly totalClicksBinding = new Binding(0);
  
  private readonly showOfflineProgressBinding = new Binding(false);
  private readonly offlineGemsBinding = new Binding("0");
  private readonly offlineDurationBinding = new Binding("0");
  
  private crystalsPerClick = 1;
  private crystalCount = 0;
  private gemAnimationInProgress = false;

  private readonly floatingNumberPool: FloatingNumberState[] = [];
  private nextFloatingNumberIndex = 0;
  private readonly FLOATING_NUMBER_POOL_SIZE = 15;
  
  start() {
    this.connectNetworkEvent(this.world.getLocalPlayer(), OnUpdatePlayerState, (data) => {
        this.crystalCount = data.crystalCount;
        this.crystalsPerClick = data.crystalsPerClick;
        this.crystalCountBinding.set(data.crystalCount)
        this.generatorsBinding.set(data.generators)
        this.currentQuestBinding.set(data.currentQuest)
        this.crystalsPerClickBinding.set(data.crystalsPerClick)
        this.nextClickMilestoneBinding.set(data.nextClickMilestone);
        this.totalGPSBinding.set(data.totalGPS);
        this.depthBinding.set(data.depth);
        this.rebirthStateBinding.set(data.rebirthState);
        this.totalClicksBinding.set(data.totalManualClicks);
    });

    this.connectNetworkEvent(this.world.getLocalPlayer(), OnGemCountUpdate, (data) => {
        this.crystalCount = data.crystalCount;
        this.crystalCountBinding.set(data.crystalCount);
        this.totalGPSBinding.set(data.totalGPS);
    });
    
    this.connectNetworkEvent(this.world.getLocalPlayer(), OnShowOfflineProgress, (data) => {
        this.offlineGemsBinding.set(this.formatCompactNumber(data.crystalsEarned));
        const hours = Math.floor(data.durationSeconds / 3600);
        const minutes = Math.floor((data.durationSeconds % 3600) / 60);
        this.offlineDurationBinding.set(`${hours}h ${minutes}m`);
        this.showOfflineProgressBinding.set(true);
    });
  }

  initializeUI(): UINode {
    for (let i = 0; i < this.FLOATING_NUMBER_POOL_SIZE; i++) {
        this.floatingNumberPool.push({
            textBinding: new Binding("+1"), yBinding: new AnimatedBinding(0),
            opacityBinding: new AnimatedBinding(0), visibleBinding: new Binding(false)
        });
    }
    
    const children: UINode[] = [];
    if (this.props.BackgroundImage) {
        children.push(Image({
            source: ImageSource.fromTextureAsset(this.props.BackgroundImage.as(hz.TextureAsset)),
            style: { position: 'absolute', width: '100%', height: '100%' },
        }));
    }
    
    children.push(UINode.if(this.isVisibleBinding, this.renderGameScreen()));
    children.push(UINode.if(this.showOfflineProgressBinding, this.renderOfflineProgressPopup()));
    
    return View({ style: { width: '100%', height: '100%' }, children: children });
  }
  
  show(): void {
    if (!this.isVisible) {
      const localPlayer = this.world.getLocalPlayer()
      if (localPlayer && localPlayer !== this.world.getServerPlayer()) {
        localPlayer.enterFocusedInteractionMode();
        hz.PlayerControls.disableSystemControls();
      }
      this.isVisible = true;
      this.isVisibleBinding.set(true);
    }
  }

  hide(): void {
    if (this.isVisible) {
      const localPlayer = this.world.getLocalPlayer()
       if (localPlayer && localPlayer !== this.world.getServerPlayer()) {
        localPlayer.exitFocusedInteractionMode();
        hz.PlayerControls.enableSystemControls();
      }
      this.isVisible = false;
      this.isVisibleBinding.set(false);
    }
  }

  private triggerFloatingNumber(text: string) {
    const numberState = this.floatingNumberPool[this.nextFloatingNumberIndex];
    this.nextFloatingNumberIndex = (this.nextFloatingNumberIndex + 1) % this.FLOATING_NUMBER_POOL_SIZE;
    
    numberState.visibleBinding.set(true);
    numberState.textBinding.set(text);
    numberState.yBinding.set(0);
    numberState.opacityBinding.set(1);
    
    numberState.yBinding.set(Animation.timing(-100, { duration: 1500, easing: Easing.out(Easing.quad) }), (finished: boolean) => {
        if (finished) { numberState.visibleBinding.set(false); }
    });
    numberState.opacityBinding.set(Animation.timing(0, { duration: 1500, easing: Easing.in(Easing.quad) }));
  }

  private formatCompactNumber(value: number): string {
    const num = Math.floor(value);
    if (num >= 1e15) return (num / 1e15).toFixed(2).replace(/\.00$/, '') + 'Q';
    if (num >= 1e12) return (num / 1e12).toFixed(2).replace(/\.00$/, '') + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2).replace(/\.00$/, '') + 'K';
    return num.toLocaleString();
  }
  
  private renderOfflineProgressPopup(): UINode {
      return View({
        style: { 
            position: 'absolute', width: '100%', height: '100%', 
            backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100
        },
        children: [
            View({
                style: { 
                    backgroundColor: '#2c3e50', padding: 30, borderRadius: 20, 
                    width: '50%', alignItems: 'center', borderWidth: 2, borderColor: '#3498db',
                    shadowColor: 'black', shadowOffset: [5, 5], shadowRadius: 10,
                },
                children: [
                    Text({ text: 'Welcome Back, Operator!', style: { color: 'white', fontSize: 48, marginBottom: 15 } }),
                    Text({ text: this.offlineDurationBinding.derive(d => `Your fleet was active for ${d} while you were away.`), style: { color: '#ecf0f1', fontSize: 24, marginBottom: 5 } }),
                    Text({ text: `Your offline production yielded:`, style: { color: '#ecf0f1', fontSize: 24, marginBottom: 20 } }),
                    Text({ text: this.offlineGemsBinding.derive(crystals => `${crystals} Crystals`), style: { color: '#f1c40f', fontSize: 60, fontWeight: 'bold', marginBottom: 30 } }),
                    Pressable({ onClick: () => this.showOfflineProgressBinding.set(false), children: [ Text({ text: 'Collect', style: { color: 'white', fontSize: 32 } }) ], style: { backgroundColor: '#27ae60', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 10 } })
                ]
            })
        ]
      });
  }

  private renderGameScreen(): UINode {
    return View({
      style: { width: '100%', height: '100%', flexDirection: 'row', padding: 20, paddingTop: 60, backgroundColor: 'rgba(0,0,0,0.5)' },
      children: [ 
          this.renderClickerPanel(), 
          View({style: {width: 20}}),
          this.renderStoreAndQuestPanel() 
        ],
    })
  }

  private renderClickerPanel(): UINode {
    const clickerContent = this.props.DiamondIcon 
        ? Image({ source: ImageSource.fromTextureAsset(this.props.DiamondIcon.as(hz.TextureAsset)), style: { width: 256, height: 256 } })
        : View({ style: { backgroundColor: '#4A90E2', width: 256, height: 256, borderRadius: 128 }});

    return View({
      style: { flex: 2, justifyContent: 'center', alignItems: 'center' },
      children: [
        View({
          style: { width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: 10, justifyContent: 'center', alignItems: 'center', position: 'relative' },
          children: [
            View({
                style: { position: 'absolute', top: '50%', marginTop: -120, zIndex: 15, alignItems: 'center' },
                children: this.floatingNumberPool.map(num => 
                    UINode.if(num.visibleBinding, View({
                        style: { position: 'absolute', transform: [{ translateY: num.yBinding }], opacity: num.opacityBinding },
                        children: [ Text({ text: num.textBinding, style: { fontSize: 48, fontWeight: 'bold', color: '#FFD700', textShadowColor: 'black', textShadowOffset: [2, 2], textShadowRadius: 2 }}) ]
                    }))
                )
            }),
            Pressable({
              onClick: (player) => {
                this.triggerFloatingNumber(`+${this.formatCompactNumber(this.crystalsPerClick)}`);
                this.sendNetworkBroadcastEvent(OnManualDrill, { player });
                
                if (this.gemAnimationInProgress) return;
                this.gemAnimationInProgress = true;
                const clickAnimation = Animation.sequence( Animation.timing(0.9, { duration: 75 }), Animation.timing(1.0, { duration: 75 }) );
                this.diamondScaleBinding.set(clickAnimation, () => { this.gemAnimationInProgress = false; });
              },
              style: { transform: [{ scale: this.diamondScaleBinding }], zIndex: 10, marginBottom: 20 },
              children: [clickerContent],
            }),
            Text({ text: this.crystalCountBinding.derive(count => `${this.formatCompactNumber(count)} Crystals`), style: { color: 'white', fontSize: 60, textShadowColor: '#000000', textShadowOffset: [2, 2] } }),
            View({ style: { flexDirection: 'row', marginTop: 10 }, children: [
                Text({ text: this.totalGPSBinding.derive(gps => `CPS: ${this.formatCompactNumber(gps)}`), style: { color: '#B2F3FF', fontSize: 22, textShadowColor: '#000000', textShadowOffset: [1, 1], marginRight: 15 } }),
                
                View({ style: { flexDirection: 'row', alignItems: 'center', marginLeft: 15 }, children: [
                    Text({ text: this.depthBinding.derive(d => `Depth: ${this.formatCompactNumber(d)}m`), style: { color: '#B2F3FF', fontSize: 22, textShadowColor: '#000000', textShadowOffset: [1, 1] } }),
                    Text({ text: this.rebirthStateBinding.derive((rs: RebirthState) => ` (+${(rs.darkMatter * 1).toFixed(0)}%)`), style: { color: '#ab47bc', fontSize: 20, fontWeight: 'bold' } }),
                ]}),
            ]}),
            View({ style: { flexDirection: 'row', alignItems: 'center', marginTop: 10}, children: [
                Text({ text: 'Current: ', style: { color: '#FFD700', fontSize: 18 } }),
                Text({ text: this.crystalsPerClickBinding.derive(cpc => `${this.formatCompactNumber(cpc)}/click`), style: { color: 'white', fontSize: 18 } }),
                Text({ text: this.nextClickMilestoneBinding.derive(milestone => {
                    if (milestone) {
                        return ` - Next at ${this.formatCompactNumber(milestone.clicks)} clicks`;
                    }
                    return " - Power Maxed!";
                }), style: { color: '#FFD700', fontSize: 18, marginLeft: 8 }}),
            ]})
          ]
        })
      ],
    })
  }
  
  private renderStoreAndQuestPanel(): UINode {
    return View({
      style: { flex: 1.5, flexDirection: 'column', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10 },
      children: [
        this.renderTabNavigation(),
        View({ style: { flex: 1, padding: 15 }, children: [
            UINode.if(this.rightPanelTabBinding.derive(tab => tab === 'Generators'), this.renderGeneratorPanel()),
            UINode.if(this.rightPanelTabBinding.derive(tab => tab === 'Rebirth'), this.renderRebirthPanel()),
        ]}),
        this.renderCurrentQuest(),
      ],
    })
  }
  
  private renderTabNavigation(): UINode {
    const tabs: RightPanelTab[] = ['Generators', 'Rebirth'];
    const icons: {[key in RightPanelTab]: hz.Asset | undefined} = {
        'Generators': this.props.GeneratorIcon,
        'Rebirth': this.props.RebirthIcon
    };

    const tabStyle: ViewStyle = {
      flex: 1, padding: 15, alignItems: 'center', justifyContent: 'center',
      borderBottomWidth: 4, flexDirection: 'row', 
    };

    return View({
        style: { flexDirection: 'row', borderBottomWidth: 2, borderColor: '#555' },
        children: tabs.map(tab => 
            Pressable({
                onClick: () => this.rightPanelTabBinding.set(tab),
                style: {
                    ...tabStyle,
                    borderColor: this.rightPanelTabBinding.derive(current => current === tab ? '#3498db' : 'transparent'),
                },
                children: [
                    icons[tab] ? Image({ source: ImageSource.fromTextureAsset(icons[tab]!.as(hz.TextureAsset)), style: {width: 24, height: 24, marginRight: 10}}) : UINode.if(false),
                    Text({ text: tab, style: { 
                        color: this.rightPanelTabBinding.derive(current => current === tab ? 'white' : '#aaa'), 
                        fontSize: 20 
                    } })
                ]
            })
        )
    });
  }

  private renderGeneratorPanel(): UINode {
      return View({ style: {flex: 1, flexDirection: 'column'}, children: [
          Text({ text: 'Generator Bay', style: { color: 'white', fontSize: 36, marginBottom: 10 } }),
          ScrollView({ style: { flex: 1, marginTop: 10 }, children: 
              DynamicList({ data: this.generatorsBinding, renderItem: (item: Generator) => this.renderGeneratorItem(item) }) 
          }),
      ]});
  }
  
  private renderRebirthPanel(): UINode {
    const rebirthDarkMatterCost = 10;
    const canRebirth = this.rebirthStateBinding.derive(rs => rs.darkMatter >= rebirthDarkMatterCost);
    
    const darkMatterBonusText = this.rebirthStateBinding.derive((rs: RebirthState) => {
        const bonus = 1 + (rs.darkMatter * 0.01);
        return `Your current Dark Matter provides a x${bonus.toFixed(2)} global production bonus.`;
    });

    return View({
        style: { flex: 1, padding: 10, backgroundColor: 'rgba(74, 20, 140, 0.2)', borderRadius: 10, alignItems: 'center' },
        children: [
            Text({ text: 'The Hyperion Core', style: { color: '#e1bee7', fontSize: 36, marginBottom: 10 } }),
            Text({ text: 'Reset your progress to earn Dark Matter, providing a permanent boost to all future runs.', style: { color: '#ddd', fontSize: 16, textAlign: 'center', marginBottom: 20 } }),
            Text({ text: this.rebirthStateBinding.derive(rs => `Dark Matter: ${rs.darkMatter}`), style: { color: 'white', fontSize: 24, fontWeight: 'bold' } }),
            Text({ text: darkMatterBonusText, style: { color: '#ab47bc', fontSize: 18, marginBottom: 20 } }),
            UINode.if( canRebirth,
                Pressable({
                    onClick: (player) => this.sendNetworkBroadcastEvent(OnPlayerRebirth, { player }),
                    children: [Text({ text: 'Rebirth Now', style: { color: 'white', fontSize: 24 } })],
                    style: { paddingVertical: 15, paddingHorizontal: 30, borderRadius: 10, backgroundColor: '#7b1fa2', borderWidth: 2, borderColor: '#e1bee7'}
                }),
                View({ style: {alignItems: 'center'}, children: [
                    Text({ text: 'Next Rebirth Cost:', style: { color: '#ce93d8', fontSize: 18}}),
                    Text({ text: `${rebirthDarkMatterCost} Dark Matter`, style: { color: 'white', fontSize: 22}}),
                ]})
            ),
        ]
    });
  }

  private renderGeneratorItem(item: Generator): UINode {
    return View({
      style: { 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: 10, 
          backgroundColor: 'rgba(255, 255, 255, 0.1)', 
          borderRadius: 5, 
          marginBottom: 10 
        },
      children: [
        View({ style: { flex: 1 }, children: [
            View({style: {flexDirection: 'row', alignItems: 'center', marginBottom: 5}, children: [
                Text({ text: `${item.name}: `, style: { color: 'white', fontSize: 22, fontWeight: 'bold' } }),
                Text({ text: `${item.owned}`, style: { color: '#f1c40f', fontSize: 22, fontWeight: 'bold' } }),
            ]}),
            
            View({ style: { flexDirection: 'row', alignItems: 'center' }, children: [
                Text({ text: `${this.formatCompactNumber(item.productionRate)} CPS`, style: { color: '#CCCCCC', fontSize: 18 } }),
                Text({ 
                    text: this.rebirthStateBinding.derive((rs: RebirthState) => {
                        const baseProduction = item.productionRate * item.owned;
                        const totalProduction = baseProduction * (1 + (rs.darkMatter * 0.01));
                        const bonus = totalProduction - baseProduction;
                        return (bonus > 0) ? ` +${this.formatCompactNumber(bonus)}` : '';
                    }), 
                    style: { 
                        color: '#ab47bc', 
                        fontSize: 20, 
                        marginLeft: 8,
                        fontWeight: 'bold',
                        textShadowColor: 'white',
                        textShadowRadius: 8,
                    } 
                }),
            ]}),
            UINode.if( item.nextMilestone !== undefined, Text({ text: `Next bonus at ${item.nextMilestone?.owned}: x${item.nextMilestone?.multiplier} Production!`, style: { color: '#FFD700', fontSize: 14, marginTop: 4 } }))
        ]}),
        
        View({ style: { alignItems: 'flex-end', justifyContent: 'center', minHeight: 70 }, children: [
             Pressable({
              disabled: this.crystalCountBinding.derive((crystals: number) => crystals < item.currentCost),
              onClick: (player) => this.sendNetworkBroadcastEvent(OnBuyGenerator, { 
                  player, 
                  generatorId: item.id, 
              }),
              children: [Text({ text: 'Buy', style: { color: 'white', fontSize: 20 } })],
              style: { 
                  backgroundColor: this.crystalCountBinding.derive((crystals: number) => crystals >= item.currentCost ? '#34A853' : '#555555'), 
                  paddingVertical: 12,
                  paddingHorizontal: 25,
                  borderRadius: 8,
                  marginBottom: 5,
                },
            }),
            Text({ text: `Cost: ${this.formatCompactNumber(item.currentCost)}`, style: { color: '#CCCCCC', fontSize: 16 } }),
        ]})
      ],
    })
  }

  private renderCurrentQuest(): UINode {
    return View({
      style: { padding: 15, backgroundColor: 'rgba(0,0,0,0.3)', borderTopWidth: 2, borderColor: '#555', minHeight: 80, justifyContent: 'center' },
      children: [
        Text({text: "Current Directive:", style: {color: '#aaa', fontSize: 14, marginBottom: 5}}),
        Text({
          text: this.currentQuestBinding.derive(quest => quest ? quest.description : "All Directives Complete!"),
          style: { color: this.currentQuestBinding.derive(quest => quest ? 'white' : '#AAAAAA'), fontSize: 18 }
        })
      ]
    })
  }
}
UIComponent.register(GameUI);
