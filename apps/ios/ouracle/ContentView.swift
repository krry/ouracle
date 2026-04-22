import SwiftUI

enum AppTab: String, CaseIterable {
    case draw    = "draw"
    case enquire = "enquire"
    case reflect = "reflect"
}

struct ContentView: View {
    @StateObject private var session = ChatSession()
    @StateObject private var accent = TreasureAccent()
    @ObservedObject private var warmer = PerformanceWarmer.shared
    @State private var currentTab: AppTab = .enquire

    var body: some View {
        if warmer.state.isReady {
            NavigationStack {
                ZStack {
                    NebulaView()
                    VStack(spacing: 0) {
                        topNav
                        Divider()
                        tabContent
                    }
                }
                .navigationTitle("ouracle")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { settingsButton }
                .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
            }
            .environmentObject(accent)
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
                            .foregroundStyle(currentTab == tab ? accent.color : Color.secondary)
                            .padding(.horizontal, 4)
                            .padding(.top, 8)

                        Rectangle()
                            .frame(height: 2)
                            .foregroundStyle(currentTab == tab ? accent.color : Color.clear)
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
        ToolbarItemGroup(placement: .topBarTrailing) {
            AmbienceToolbarButton()
            SettingsToolbarButton()
        }
    }
}

private struct AmbienceToolbarButton: View {
    @State private var showAmbience = false
    @ObservedObject private var ambience = AmbienceService.shared

    var body: some View {
        Button {
            showAmbience = true
        } label: {
            Image(systemName: ambience.activeClimeID != nil ? "waveform.circle.fill" : "waveform.circle")
                .foregroundStyle(ambience.activeClimeID != nil ? Color.jing : Color.secondary)
        }
        .sheet(isPresented: $showAmbience) {
            NavigationStack {
                ViewsAmbiencePickerView()
                    .navigationTitle("ambience")
                    .navigationBarTitleDisplayMode(.inline)
            }
            .presentationDetents([.height(280)])
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
