import * as hz from 'horizon/core'
import { Color } from 'horizon/core' 
import {
  UIComponent, View, Text, Pressable, Binding, UINode,
  DynamicList, Image, ImageSource, ScrollView, AnimatedBinding, Animation, Easing, ViewStyle
} from 'horizon/ui'
import {
  Generator, QuestDisplayData, OnUpdatePlayerState, OnManualDrill, OnBuyGenerator, ClickMilestone,
  OnGemCountUpdate, OnActivateBoost, Boost, OnBoostStateUpdate, RebirthState, OnPlayerRebirth,
  OnShowOfflineProgress
} from './Events'

type FloatingNumberState = {
    textBinding: Binding<string>;
    yBinding: AnimatedBinding;
    opacityBinding: AnimatedBinding;
    visibleBinding: Binding<boolean>;
};

type PurchaseAmount = 1 | 10 | 50 | 'MAX';

export class GameUI extends UIComponent<typeof GameUI> {
  static propsDefinition = {
    BackgroundImage: { type: hz.PropTypes.Asset },
    DiamondIcon: { type: hz.PropTypes.Asset },
    BoostIcon: { type: hz.PropTypes.Asset },
  }

  private readonly purchaseAmountBinding = new Binding<PurchaseAmount>(1);
  // [FIXED] Store the purchase amount in a regular variable for script access.
  private purchaseAmount: PurchaseAmount = 1;

  private readonly crystalCountBinding = new Binding(0)
  private readonly crystalsPerClickBinding = new Binding(1);
  private readonly generatorsBinding = new Binding<Generator[]>([])
  private readonly currentQuestBinding = new Binding<QuestDisplayData>({id: 0, description: "Loading Quest..."})
  private readonly currentScreenBinding = new Binding<'menu' | 'game'>('menu')
  private readonly diamondScaleBinding = new AnimatedBinding(1);
  private readonly nextClickMilestoneBinding = new Binding<ClickMilestone | null>(null);
  private readonly totalGPSBinding = new Binding(0);
  private readonly depthBinding = new Binding(0);
  private readonly boostsBinding = new Binding<Boost[]>([]);
  private readonly rebirthStateBinding = new Binding<RebirthState>({ darkMatter: 0, peakCPS: 0 });
  
  private readonly showOfflineProgressBinding = new Binding(false);
  private readonly offlineGemsBinding = new Binding("0");
  private readonly offlineDurationBinding = new Binding("0");
  
  private crystalsPerClick = 1;
  private crystalCount = 0;
  private gemAnimationInProgress = false;

  private readonly floatingNumberPool: FloatingNumberState[] = [];
  private nextFloatingNumberIndex = 0;
  private readonly FLOATING_NUMBER_POOL_SIZE = 10;
  
  start() {
    const localPlayer = this.world.getLocalPlayer()
    if (localPlayer && localPlayer !== this.world.getServerPlayer()) {
      localPlayer.enterFocusedInteractionMode()
      hz.PlayerControls.disableSystemControls()
    }

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
    });

    this.connectNetworkEvent(this.world.getLocalPlayer(), OnGemCountUpdate, (data) => {
        this.crystalCount = data.crystalCount;
        this.crystalCountBinding.set(data.crystalCount);
        this.totalGPSBinding.set(data.totalGPS);
    });
    
    this.connectNetworkEvent(this.world.getLocalPlayer(), OnBoostStateUpdate, (data) => { 
        this.boostsBinding.set(data.boosts); 
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

    const mainView = UINode.if(
      this.currentScreenBinding.derive(s => s === 'menu'),
      this.renderMenuScreen(), this.renderGameScreen(),
    );
    const children: UINode[] = [];
    if (this.props.BackgroundImage) {
        children.push(Image({
            source: ImageSource.fromTextureAsset(this.props.BackgroundImage.as(hz.TextureAsset)),
            style: { position: 'absolute', width: '100%', height: '100%' },
        }));
    }
    children.push(View({ style: { position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.5)' } }));
    children.push(mainView);
    children.push(UINode.if(this.showOfflineProgressBinding, this.renderOfflineProgressPopup()));
    return View({ style: { width: '100%', height: '100%' }, children: children });
  }

  private triggerFloatingNumber(text: string) {
    const numberState = this.floatingNumberPool[this.nextFloatingNumberIndex];
    this.nextFloatingNumberIndex = (this.nextFloatingNumberIndex + 1) % this.FLOATING_NUMBER_POOL_SIZE;
    numberState.visibleBinding.set(true);
    numberState.textBinding.set(text);
    numberState.yBinding.set(0);
    numberState.opacityBinding.set(1);
    numberState.yBinding.set(Animation.timing(-100, { duration: 1500, easing: Easing.out(Easing.quad) }), () => {
        numberState.visibleBinding.set(false);
    });
    numberState.opacityBinding.set(Animation.timing(0, { duration: 1500, easing: Easing.in(Easing.quad) }));
  }

  private formatCompactNumber(value: number): string {
    const num = Math.floor(value);
    if (num >= 1e12) return (num / 1e12).toFixed(2).replace(/\.00$/, '') + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2).replace(/\.00$/, '') + 'K';
    return num.toString();
  }

  private formatTime(milliseconds: number): string {
    if (milliseconds <= 0) { return "Ready"; }
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private renderMenuScreen(): UINode {
    return View({
      style: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
      children: [
        Text({ text: 'Idle Crystal Clicker', style: { color: 'white', fontSize: 80, marginBottom: 10, textShadowColor: '#000000', textShadowOffset: [3, 3] } }),
        Text({ text: 'Click to build your empire!', style: { color: 'white', fontSize: 24, marginBottom: 40, textShadowColor: '#000000', textShadowOffset: [2, 2] } }),
        Pressable({
          onClick: () => this.currentScreenBinding.set('game'),
          children: [Text({ text: 'Play Game', style: { color: 'white', fontSize: 32 } })],
          style: { backgroundColor: '#34A853', padding: 25, borderRadius: 15, borderWidth: 2, borderColor: '#FFFFFF' }
        })
      ]
    });
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
      style: { width: '100%', height: '100%', flexDirection: 'row', padding: 20 },
      children: [ this.renderClickerPanel(), this.renderStoreAndQuestPanel() ],
    })
  }

  private renderClickerPanel(): UINode {
    let clickerContent: UINode;
    if (this.props.DiamondIcon) {
        clickerContent = Image({ source: ImageSource.fromTextureAsset(this.props.DiamondIcon.as(hz.TextureAsset)), style: { width: 256, height: 256 } });
    } else {
        clickerContent = View({ style: { backgroundColor: '#4A90E2', padding: 20, borderRadius: 10, borderWidth: 2, borderColor: '#FFFFFF' }});
    }
    return View({
      style: { flex: 2, justifyContent: 'center', alignItems: 'center', padding: 10, marginRight: 10 },
      children: [
        View({
          style: { width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.5)', borderRadius: 10, justifyContent: 'center', alignItems: 'center', position: 'relative' },
          children: [
            View({
                style: { position: 'absolute', top: '50%', marginTop: -120, zIndex: 15 },
                children: this.floatingNumberPool.map(num => 
                    UINode.if(num.visibleBinding, View({
                        style: { transform: [{ translateY: num.yBinding }], opacity: num.opacityBinding },
                        children: [ Text({ text: num.textBinding, style: { fontSize: 48, fontWeight: 'bold', color: '#FFD700', textShadowColor: 'black', textShadowOffset: [2, 2], textShadowRadius: 2 }}) ]
                    }))
                )
            }),
            Pressable({
              onClick: (player) => {
                this.crystalCount += this.crystalsPerClick;
                this.crystalCountBinding.set(this.crystalCount);
                this.triggerFloatingNumber(`+${this.formatCompactNumber(this.crystalsPerClick)}`);
                this.sendNetworkBroadcastEvent(OnManualDrill, { player });
                if (this.gemAnimationInProgress) return;
                this.gemAnimationInProgress = true;
                const clickAnimation = Animation.sequence( Animation.timing(0.9, { duration: 75 }), Animation.timing(1.0, { duration: 75 }) );
                this.diamondScaleBinding.set(clickAnimation, () => { this.gemAnimationInProgress = false; });
              },
              style: { transform: [{ scale: this.diamondScaleBinding }], zIndex: 10, marginBottom: 20, },
              children: [clickerContent],
            }),
            Text({ text: this.crystalCountBinding.derive(count => `Crystals: ${this.formatCompactNumber(count)}`), style: { color: 'white', fontSize: 60, textShadowColor: '#000000', textShadowOffset: [2, 2] } }),
            View({ style: { flexDirection: 'row', marginTop: 10 }, children: [
                Text({ text: this.totalGPSBinding.derive(gps => `CPS: ${this.formatCompactNumber(gps)}`), style: { color: '#B2F3FF', fontSize: 22, textShadowColor: '#000000', textShadowOffset: [1, 1], marginRight: 15 } }),
                Text({ text: this.depthBinding.derive(d => `Depth: ${this.formatCompactNumber(d)}m`), style: { color: '#B2F3FF', fontSize: 22, textShadowColor: '#000000', textShadowOffset: [1, 1], marginLeft: 15 } }),
            ]}),
            Text({ text: this.nextClickMilestoneBinding.derive(milestone => {
                if (milestone) { return `Next Upgrade at ${this.formatCompactNumber(milestone.clicks)} Clicks: ${milestone.crystalsPerClick} Crystals per Click!`; }
                return "Click Power Maxed Out!";
            }), style: { color: '#FFD700', fontSize: 18, marginTop: 10 }}),
            View({ style: { position: 'absolute', bottom: 20, flexDirection: 'row' }, children: DynamicList({ data: this.boostsBinding, renderItem: (boost: Boost) => this.renderBoostButton(boost) }) })
          ]
        })
      ],
    })
  }

  private renderBoostButton(boost: Boost): UINode {
    const now = Date.now();
    const isOnCooldown = now < boost.cooldownEndsAt;
    const isReady = !boost.isActive && !isOnCooldown;
    const buttonText = boost.isActive ? this.formatTime(boost.activeEndsAt - now) : (isOnCooldown ? this.formatTime(boost.cooldownEndsAt - now) : 'Activate');
    
    const activeBorderColor = '#FFD700';

    return Pressable({
        disabled: !isReady,
        onClick: (player) => this.sendNetworkBroadcastEvent(OnActivateBoost, { player, boostId: boost.id }),
        style: {
            width: 150, height: 150, borderRadius: 75, marginHorizontal: 15,
            backgroundColor: boost.isActive ? '#FFC107' : (isReady ? '#4CAF50' : '#607D8B'),
            borderWidth: 4, 
            borderColor: boost.isActive ? activeBorderColor : 'white',
            justifyContent: 'center', alignItems: 'center',
            shadowColor: 'black', shadowOffset: [3, 3], shadowRadius: 5,
        },
        children: [
            this.props.BoostIcon ? Image({ source: ImageSource.fromTextureAsset(this.props.BoostIcon.as(hz.TextureAsset)), style: { width: 64, height: 64, marginBottom: 5 }}) : UINode.if(false),
            Text({ text: boost.name, style: { color: 'white', fontSize: 16, fontWeight: 'bold' } }),
            Text({ text: buttonText, style: { color: 'white', fontSize: 18 } })
        ]
    });
  }

  private renderStoreAndQuestPanel(): UINode {
    return View({
      style: { flex: 1.5, flexDirection: 'column', padding: 10, marginLeft: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10 },
      children: [
        this.renderRebirthPanel(),
        Text({ text: 'Generator Bay', style: { color: 'white', fontSize: 36, marginBottom: 10, marginTop: 10 } }),
        this.renderPurchaseAmountToggle(),
        ScrollView({ style: { flex: 1, marginTop: 10 }, children: DynamicList({ data: this.generatorsBinding, renderItem: (item: Generator) => this.renderGeneratorItem(item) }) }),
        Text({ text: 'Current Quest', style: { color: 'white', fontSize: 36, marginTop: 20, marginBottom: 10 } }),
        this.renderCurrentQuest(),
      ],
    })
  }
  
  private renderPurchaseAmountToggle(): UINode {
      const amounts: PurchaseAmount[] = [1, 10, 50, 'MAX'];
      
      const buttonStyle: ViewStyle = {
          flex: 1, padding: 10, borderRadius: 5,
          alignItems: 'center', marginHorizontal: 5, borderColor: '#ecf0f1',
      };

      return View({
          style: { flexDirection: 'row', justifyContent: 'space-around' },
          children: amounts.map(amount => 
              Pressable({
                  onClick: () => {
                      this.purchaseAmountBinding.set(amount);
                      this.purchaseAmount = amount;
                  },
                  // [FIXED #2] Apply bindings to individual style properties, not the whole style object.
                  style: {
                      ...buttonStyle,
                      backgroundColor: this.purchaseAmountBinding.derive(current => current === amount ? '#3498db' : '#2c3e50'),
                      borderWidth: this.purchaseAmountBinding.derive(current => current === amount ? 2 : 0),
                  },
                  children: [ Text({ text: `x${amount}`, style: { color: 'white', fontSize: 18 } }) ]
              })
          )
      });
  }

  private renderRebirthPanel(): UINode {
    const rebirthCrystalCost = 1e15;
    const canRebirth = this.crystalCountBinding.derive(crystals => crystals >= rebirthCrystalCost);
    
    const darkMatterBonusText = this.rebirthStateBinding.derive((rs: RebirthState) => {
        const bonus = 1 + (rs.darkMatter * 0.02);
        return `Global Bonus: x${bonus.toFixed(2)}`;
    });

    return View({
        style: { padding: 10, backgroundColor: 'rgba(74, 20, 140, 0.5)', borderRadius: 10, alignItems: 'center' },
        children: [
            Text({ text: 'The Hyperion Core', style: { color: '#e1bee7', fontSize: 24, marginBottom: 5 } }),
            Text({ text: this.rebirthStateBinding.derive(rs => `Dark Matter: ${rs.darkMatter}`), style: { color: 'white', fontSize: 18 } }),
            Text({ text: darkMatterBonusText, style: { color: '#ab47bc', fontSize: 18, marginBottom: 10 } }),
            UINode.if( canRebirth,
                Pressable({
                    onClick: (player) => this.sendNetworkBroadcastEvent(OnPlayerRebirth, { player }),
                    children: [Text({ text: 'Rebirth', style: { color: 'white', fontSize: 20 } })],
                    style: { padding: 10, borderRadius: 5, backgroundColor: '#7b1fa2' }
                }),
                Text({ text: `Reach ${this.formatCompactNumber(rebirthCrystalCost)} Crystals to Rebirth`, style: { color: '#ce93d8' } })
            )
        ]
    });
  }

  private renderGeneratorItem(item: Generator): UINode {
    const costIncreaseRatio = 1.15;
    
    const costText = this.purchaseAmountBinding.derive(amount => {
        if (amount === 1) {
            return `Cost: ${this.formatCompactNumber(item.currentCost)} Crystals`;
        }
        if (amount === 'MAX') {
            return `Buy MAX`;
        }
        let cumulativeCost = 0;
        for (let i = 0; i < amount; i++) {
            cumulativeCost += Math.floor(item.baseCost * Math.pow(costIncreaseRatio, item.owned + i));
        }
        return `Cost: ${this.formatCompactNumber(cumulativeCost)} Crystals`;
    });

    return View({
      style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 5, marginBottom: 10 },
      children: [
        View({ style: { flex: 1 }, children: [
            Text({ text: item.name, style: { color: 'white', fontSize: 20 } }),
            Text({ text: costText, style: { color: '#CCCCCC', fontSize: 14 } }),
            Text({ text: `+${this.formatCompactNumber(item.productionRate)} CPS`, style: { color: '#CCCCCC', fontSize: 14 } }),
            UINode.if( item.nextMilestone !== undefined, Text({ text: `Next bonus at ${item.nextMilestone?.owned}: x${item.nextMilestone?.multiplier} Production!`, style: { color: '#FFD700', fontSize: 14, marginTop: 4 } }))
        ]}),
        View({ style: { alignItems: 'center' }, children: [
            Text({ text: `Owned: ${item.owned}`, style: { color: 'white', fontSize: 20 } }),
            Pressable({
              disabled: this.crystalCountBinding.derive(crystals => crystals < item.currentCost),
              onClick: (player) => this.sendNetworkBroadcastEvent(OnBuyGenerator, { 
                  player, 
                  generatorId: item.id, 
                  // [FIXED #1] Use the class variable to get the current purchase amount.
                  amount: this.purchaseAmount 
              }),
              children: [Text({ text: 'Buy', style: { color: 'white', fontSize: 18 } })],
              style: { backgroundColor: this.crystalCountBinding.derive(crystals => crystals >= item.currentCost ? '#34A853' : '#555555'), padding: 10, borderRadius: 5 },
            }),
        ]})
      ],
    })
  }

  private renderCurrentQuest(): UINode {
    return View({
      style: { padding: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 5, minHeight: 60, justifyContent: 'center' },
      children: [
        Text({
          text: this.currentQuestBinding.derive(quest => quest ? quest.description : "All Quests Complete!"),
          style: { color: this.currentQuestBinding.derive(quest => quest ? 'white' : '#AAAAAA'), fontSize: 18 }
        })
      ]
    })
  }
}
UIComponent.register(GameUI);
