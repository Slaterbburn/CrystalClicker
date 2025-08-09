import * as hz from 'horizon/core'
import { 
  UIComponent, 
  View, 
  Text, 
  Pressable, 
  UINode, 
  Binding 
} from 'horizon/ui'
import { OnNavigateToGame, OnNavigateToLeaderboards } from './Events';

export class MenuUI extends UIComponent {
  private isVisible: boolean = true;
  private isVisibleBinding = new Binding(true);
  private welcomeMessageBinding = new Binding("Welcome, Operator!");

  start() {
    const localPlayer = this.world.getLocalPlayer();
    if(localPlayer) {
      this.welcomeMessageBinding.set(`Welcome To Idle Crystal Clicker, ${localPlayer.name.get()}`);
    }
  }

  initializeUI(): UINode {
    return UINode.if(this.isVisibleBinding, () => 
      View({
        style: { 
          width: '100%', height: '100%', 
          flexDirection: 'row', 
          padding: 40,
          backgroundColor: 'rgba(0, 0, 0, 0.7)'
        },
        children: [
          this.renderLeftPanel(),
          this.renderRightPanel()
        ]
      })
    );
  }

  private renderLeftPanel(): UINode {
    return View({
        style: { 
          flex: 1.5,
          flexDirection: 'column',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRadius: 20, 
          padding: 25,
          marginRight: 20,
        },
        children: [
          Text({
            text: "UPDATE LOG, NEWS, & EVENTS",
            style: { color: '#FFD700', fontSize: 36, fontWeight: 'bold', marginBottom: 20 }
          }),
          View({
            style: { flex: 1 },
            children: [
              Text({
                text: "v1.5 - The UI Overhaul Update!\n\n- Completely redesigned Main Menu for a more immersive experience.\n- Added a new Leaderboards screen to track top players.\n- Fixed a bug where offline progress wouldn't calculate correctly.\n- Paved the way for exciting new features coming soon!",
                style: { color: 'white', fontSize: 20, lineHeight: 30 }
              })
            ]
          })
        ]
    });
  }

  private renderRightPanel(): UINode {
    return View({
        style: { 
          flex: 1, 
          flexDirection: 'column', 
        },
        children: [
            Text({ text: this.welcomeMessageBinding, style: { color: '#CCCCCC', fontSize: 22, marginBottom: 20, textAlign: 'left' } }),
            this.renderNavButton("CONTINUE GAME", () => this.sendLocalBroadcastEvent(OnNavigateToGame, {})),
            this.renderNavButton("RANKS & STATS", () => console.log("Ranks & Stats Clicked (Not Implemented)")),
            this.renderNavButton("LEADERBOARDS", () => this.sendLocalBroadcastEvent(OnNavigateToLeaderboards, {})),
            this.renderNavButton("STORE / REWARDS", () => console.log("Store Clicked (Not Implemented)")),
            this.renderNavButton("CODEX", () => console.log("Codex Clicked (Not Implemented)")),
            View({ style: { flex: 1 } }), 
            View({
                style: { padding: 15, backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 10, alignItems: 'center'},
                children: [
                    Text({ text: '[📋 PLANNED] Global Stats Ticker', style: { color: '#FFD700', fontSize: 18 } }),
                    Text({ text: 'Total Crystals Mined World-Wide: 1.23B', style: { color: 'white', fontSize: 14, marginTop: 5 } }),
                ]
            })
        ]
    });
  }

  private renderNavButton(text: string, onClick: () => void): UINode {
    return Pressable({
      onClick,
      children: [ Text({ text, style: { color: 'white', fontSize: 28, fontWeight: 'bold' } }) ],
      style: {
        backgroundColor: 'rgba(30, 30, 30, 0.8)',
        borderWidth: 2,
        borderColor: '#888',
        padding: 20,
        borderRadius: 10,
        marginBottom: 15,
        alignItems: 'center'
      }
    });
  }
  
  show(): void {
    if (!this.isVisible) {
      this.isVisible = true;
      this.isVisibleBinding.set(true);
    }
  }

  hide(): void {
    if (this.isVisible) {
      this.isVisible = false;
      this.isVisibleBinding.set(false);
    }
  }
}
hz.Component.register(MenuUI);
