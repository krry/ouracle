import SwiftUI
import Combine

@MainActor
public final class Router: ObservableObject {
    @Published public var path = NavigationPath()
    @Published var currentRoute: Route?
    private(set) var pathHistory: [Route] = []

    func navigate(to route: Route) {
        path.append(route)
        pathHistory.append(route)
        currentRoute = route
    }

    func navigateBack() {
        guard !path.isEmpty else { return }
        path.removeLast()
        if !pathHistory.isEmpty { pathHistory.removeLast() }
        currentRoute = pathHistory.last
    }

    func navigateToRoot() {
        path = NavigationPath()
        pathHistory.removeAll()
        currentRoute = nil
    }

    func replace(with route: Route) {
        if !path.isEmpty {
            path.removeLast()
            if !pathHistory.isEmpty { pathHistory.removeLast() }
        }
        path.append(route)
        pathHistory.append(route)
        currentRoute = route
    }
}
