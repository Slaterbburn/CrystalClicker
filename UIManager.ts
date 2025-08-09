import * as hz from 'horizon/core'

/**
 * UIManager is a server-side script responsible for spawning a personal UI 
 * for each player and assigning them ownership so they can see it.
 */
export class UIManager extends hz.Component<typeof UIManager> {
  static propsDefinition = {
    // This requires a "Template Asset" of your GameUI gizmo.
    GameUIPrefab: { type: hz.PropTypes.Asset },
  }

  start() {
    // Listen for new players entering the world.
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterWorld, (player) => {
      this.initPlayerUI(player);
    });

    // Also handle any players already in the world when the script starts up.
    this.world.getPlayers().forEach(player => this.initPlayerUI(player));
  }

  private async initPlayerUI(player: hz.Player) {
    if (!this.props.GameUIPrefab) {
      console.error("ERROR: The 'GameUIPrefab' property is not set in the UIManager script. The UI will not load for players.");
      return;
    }

    // [FIXED] Correctly cast the asset to hz.Asset for spawning.
    const gameUIPrefab = this.props.GameUIPrefab.as(hz.Asset);
    
    // Instantiate the UI and assign the player as the creator
    const [gameUIInstance] = await this.world.spawnAsset(gameUIPrefab, new hz.Vec3(0, 0, 0));

    // The critical step: Assign ownership to the player to make the UI visible
    if (gameUIInstance) {
      gameUIInstance.owner.set(player);
    }
  }
}

hz.Component.register(UIManager);
