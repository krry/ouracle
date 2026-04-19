import SwiftUI

/// Shared OURACLE sheet styling for lists and forms.
struct OuracleSheetKit {
    static func listStyle(_ view: some View, scrollDisabled: Bool) -> some View {
        let styled = view
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .scrollDisabled(scrollDisabled)
            .background(Color.clear)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .transaction { transaction in
                transaction.animation = nil
            }
        if #available(iOS 17.0, *) {
            return styled.listSectionSpacing(.compact)
        }
        return styled
    }

    static func formStyle(_ view: some View, scrollDisabled: Bool) -> some View {
        view
            .formStyle(.grouped)
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .scrollDisabled(scrollDisabled)
            .background(Color.clear)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .transaction { transaction in
                transaction.animation = nil
            }
    }
}

extension View {
    func ouracleListSheetStyle(scrollDisabled: Bool) -> some View {
        OuracleSheetKit.listStyle(self, scrollDisabled: scrollDisabled)
    }

    func ouracleFormSheetStyle(scrollDisabled: Bool) -> some View {
        OuracleSheetKit.formStyle(self, scrollDisabled: scrollDisabled)
    }
}

/// Clears the UIKit sheet container background to allow true translucency.
struct ClearPresentationBackground: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        DispatchQueue.main.async {
            var current = view.superview
            var cleared = 0
            while current != nil && cleared < 10 {
                current?.backgroundColor = .clear
                current?.isOpaque = false
                current = current?.superview
                cleared += 1
            }
        }
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}
