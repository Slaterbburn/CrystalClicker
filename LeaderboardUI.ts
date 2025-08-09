import * as hz from 'horizon/core'
import { 
  UIComponent, 
  View, 
  Text, 
  Pressable, 
  UINode, 
  Binding,
  DynamicList
} from 'horizon/ui'
import { OnNavigateToMenu, OnRequestLeaderboardData, LeaderboardEntryData } from './Events';

export class LeaderboardUI extends UIComponent {
  private isVisible: boolean = false;
  private isVisibleBinding = new Binding(false);
  
  private leaderboardEntriesBinding = new Binding<LeaderboardEntryData[]>([]);
  private currentLeaderboardTitleBinding = new Binding("Leaderboard");

  initializeUI(): UINode {
    return UINode.if(this.isVisibleBinding, () => 
      View({
        style: { 
          width: '100%', height: '100%',
          backgroundColor: 'rgba(10, 20, 40, 0.95)',
          justifyContent: 'center',
          alignItems: 'center'
        },
        children: [
          View({
            style: {
              width: '80%', height: '85%',
              backgroundColor: 'rgba(0,0,0,0.4)',
              borderRadius: 20,
              padding: 30,
              flexDirection: 'column',
              borderWidth: 2,
              borderColor: '#3498db'
            },
            children: [
              View({
                style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 2, borderColor: '#3498db', paddingBottom: 15 },
                children: [
                  Text({ text: this.currentLeaderboardTitleBinding, style: { color: '#FFD700', fontSize: 48, fontWeight: 'bold' } }),
                  Pressable({
                    onClick: () => this.sendLocalBroadcastEvent(OnNavigateToMenu, {}),
                    children: [Text({ text: "BACK TO MENU", style: { color: 'white', fontSize: 24 } })],
                    style: { backgroundColor: '#c0392b', paddingVertical: 10, paddingHorizontal: 30, borderRadius: 8 }
                  })
                ]
              }),
              DynamicList({
                data: this.leaderboardEntriesBinding,
                renderItem: (item: LeaderboardEntryData, index: number) => this.renderLeaderboardItem(item, index)
              })
            ]
          })
        ]
      })
    );
  }
  
  private renderLeaderboardItem(item: LeaderboardEntryData, index: number): UINode {
    return View({
      style: {
        flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 10,
        backgroundColor: index % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent',
        alignItems: 'center',
        borderRadius: 5
      },
      children: [
        Text({ text: `#${item.rank}`, style: { color: '#FFD700', fontSize: 28, fontWeight: 'bold', width: '15%' } }),
        Text({ text: item.displayName, style: { color: 'white', fontSize: 28, width: '60%' } }),
        Text({ text: item.score.toLocaleString(), style: { color: '#3498db', fontSize: 28, width: '25%', textAlign: 'right' } }),
      ]
    });
  }

  public updateLeaderboardData(title: string, entries: LeaderboardEntryData[]) {
    this.currentLeaderboardTitleBinding.set(title);
    this.leaderboardEntriesBinding.set(entries);
  }

  show(leaderboardApiName: string): void {
    if (!this.isVisible) {
      this.isVisible = true;
      this.isVisibleBinding.set(true);
      this.sendLocalBroadcastEvent(OnRequestLeaderboardData, { leaderboardApiName });
    }
  }

  hide(): void {
    if (this.isVisible) {
      this.isVisible = false;
      this.isVisibleBinding.set(false);
      this.leaderboardEntriesBinding.set([]);
    }
  }
}
hz.Component.register(LeaderboardUI);
