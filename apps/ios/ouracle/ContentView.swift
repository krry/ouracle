import SwiftUI

enum AppTab: String, CaseIterable {
    case draw    = "draw"
    case enquire = "enquire"
    case reflect = "reflect"
}

struct ContentView: View {
    @StateObject private var session = ChatSession()
    @ObservedObject private var warmer = PerformanceWarmer.shared
    @State private var currentTab: AppTab = .enquire

    var body: some View {
        if warmer.state.isReady {
            NavigationStack {
                VStack(spacing: 0) {
                    topNav
                    Divider()
                    tabContent
                }
                .navigationTitle("ouracle")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { settingsButton }
            }
        } else {
            LaunchProgressView(warmer: warmer)
        }
    }

    // MARK: - Top nav strip

    private var topNav: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                Button {
                    currentTab = tab
                } label: {
                    VStack(spacing: 4) {
                        Text(tab.rawValue)
                            .font(.system(.caption, design: .monospaced).weight(currentTab == tab ? .semibold : .regular))
                            .foregroundStyle(currentTab == tab ? Color.jing : Color.secondary)
                            .padding(.horizontal, 4)
                            .padding(.top, 8)

                        Rectangle()
                            .frame(height: 2)
                            .foregroundStyle(currentTab == tab ? Color.jing : Color.clear)
                            .animation(.easeOut(duration: 0.15), value: currentTab)
                    }
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 8)
    }

    // MARK: - Content

    @ViewBuilder
    private var tabContent: some View {
        switch currentTab {
        case .draw:
            ViewsDrawView()
        case .enquire:
            ViewsChatView(session: session)
        case .reflect:
            ViewsRecordsView()
        }
    }

    // MARK: - Settings toolbar button

    private var settingsButton: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            SettingsToolbarButton()
        }
    }
}

private struct SettingsToolbarButton: View {
    @State private var showSettings = false

    var body: some View {
        Button {
            showSettings = true
        } label: {
            Image(systemName: "gearshape")
                .foregroundStyle(Color.secondary)
        }
        .sheet(isPresented: $showSettings) {
            NavigationStack {
                ViewsSettingsView()
                    .navigationTitle("settings")
                    .navigationBarTitleDisplayMode(.inline)
            }
            .presentationDetents([.medium])
        }
    }
}

#Preview {
    ContentView()
}
