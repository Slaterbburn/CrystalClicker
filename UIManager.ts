import * as hz from 'horizon/core';
import { GameUI } from './GameUI';
import { MenuUI } from './MenuUI';
import { OnNavigateToGame } from './Events';

/**
 * UIManager is a server-side script responsible for managing the player's UI state,
 * switching between the menu and the main game screen.
 */
export class UIManager extends hz.Component<typeof UIManager> {
  static propsDefinition = {
    GameUIGizmo: { type: hz.PropTypes.Entity },
    MenuUIGizmo: { type: hz.PropTypes.Entity },
  };

  start() {
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterWorld, (player) => {
      this.initPlayerUI(player);
    });

    this.world.getPlayers().forEach(player => this.initPlayerUI(player));

    this.connectLocalBroadcastEvent(OnNavigateToGame, () => {
      this.showGameUI();
    });
  }

  private initPlayerUI(player: hz.Player) {
    if (!this.props.GameUIGizmo || !this.props.MenuUIGizmo) {
      console.error("UIManager: GameUIGizmo or MenuUIGizmo is not set in the properties.");
      return;
    }

    this.props.GameUIGizmo.owner.set(player);
    this.props.MenuUIGizmo.owner.set(player);

    this.async.setTimeout(() => {
        this.showMenuUI();
    }, 100);
  }

  private showMenuUI() {
    if (!this.props.GameUIGizmo || !this.props.MenuUIGizmo) return;

    const gameUI = this.props.GameUIGizmo.getComponents(GameUI)[0];
    const menuUI = this.props.MenuUIGizmo.getComponents(MenuUI)[0];
    
    if (gameUI) gameUI.hide();
    if (menuUI) menuUI.show();
  }

  private showGameUI() {
    if (!this.props.GameUIGizmo || !this.props.MenuUIGizmo) return;

    const gameUI = this.props.GameUIGizmo.getComponents(GameUI)[0];
    const menuUI = this.props.MenuUIGizmo.getComponents(MenuUI)[0];

    if (gameUI) gameUI.show();
    if (menuUI) menuUI.hide();
  }
}

hz.Component.register(UIManager);
