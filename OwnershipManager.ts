import * as hz from 'horizon/core'

export class OwnershipManager extends hz.Component<typeof OwnershipManager> {
  static propsDefinition = {
    gameUI: { type: hz.PropTypes.Entity },
  }

  start() {
    this.connectCodeBlockEvent(
      this.entity,
      hz.CodeBlockEvents.OnPlayerEnterWorld,
      (player: hz.Player) => {
        if (this.props.gameUI) {
          this.props.gameUI.owner.set(player)
        }
      },
    )
  }
}
hz.Component.register(OwnershipManager)