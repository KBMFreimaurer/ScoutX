import AppIntents
import Foundation

@available(iOS 18.0, *)
enum ScoutXDestination: String, AppEnum {
    case setup
    case games
    case plan
    case scoutSheet
    case dashboard

    static var typeDisplayRepresentation: TypeDisplayRepresentation {
        TypeDisplayRepresentation(name: "ScoutX Bereich")
    }

    static var caseDisplayRepresentations: [ScoutXDestination: DisplayRepresentation] {
        [
            .setup: DisplayRepresentation(title: "Setup"),
            .games: DisplayRepresentation(title: "Spiele"),
            .plan: DisplayRepresentation(title: "Plan"),
            .scoutSheet: DisplayRepresentation(title: "Scout Sheet"),
            .dashboard: DisplayRepresentation(title: "Dashboard"),
        ]
    }
}

@available(iOS 18.0, *)
private func destinationURL(for destination: ScoutXDestination) -> URL {
    switch destination {
    case .setup:
        return URL(string: "scoutx://setup")!
    case .games:
        return URL(string: "scoutx://games")!
    case .plan:
        return URL(string: "scoutx://plan")!
    case .scoutSheet:
        return URL(string: "scoutx://scout-sheet")!
    case .dashboard:
        return URL(string: "scoutx://dashboard")!
    }
}

@available(iOS 18.0, *)
struct OpenScoutXDestinationIntent: AppIntent {
    static var title: LocalizedStringResource = "ScoutX Bereich öffnen"
    static var description = IntentDescription("Öffnet einen ScoutX-Bereich direkt in der App.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Bereich")
    var destination: ScoutXDestination

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(destinationURL(for: destination)))
    }
}

@available(iOS 18.0, *)
struct OpenNextScoutingGameIntent: AppIntent {
    static var title: LocalizedStringResource = "Nächstes Scouting-Spiel öffnen"
    static var description = IntentDescription("Öffnet die Spieleansicht für das nächste geplante Scouting-Spiel.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(URL(string: "scoutx://games")!))
    }
}

@available(iOS 18.0, *)
struct StartScoutSheetIntent: AppIntent {
    static var title: LocalizedStringResource = "Scout Sheet starten"
    static var description = IntentDescription("Öffnet das Scout Sheet in ScoutX.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(URL(string: "scoutx://scout-sheet")!))
    }
}

@available(iOS 18.0, *)
struct ScoutXShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenScoutXDestinationIntent(),
            phrases: [
                "Öffne \(.applicationName) \(\.$destination)",
                "Starte \(\.$destination) in \(.applicationName)",
            ],
            shortTitle: "Bereich öffnen",
            systemImageName: "square.grid.2x2"
        )
        AppShortcut(
            intent: OpenNextScoutingGameIntent(),
            phrases: [
                "Öffne nächstes Scouting-Spiel in \(.applicationName)",
                "Starte Spiele in \(.applicationName)",
            ],
            shortTitle: "Nächstes Spiel",
            systemImageName: "soccerball"
        )
        AppShortcut(
            intent: StartScoutSheetIntent(),
            phrases: [
                "Starte Scout Sheet in \(.applicationName)",
            ],
            shortTitle: "Scout Sheet",
            systemImageName: "doc.text.magnifyingglass"
        )
    }
}
