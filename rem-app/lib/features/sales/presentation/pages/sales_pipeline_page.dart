import 'sales_document_model.dart';
import 'sales_bloc.dart';

/// Composant d'interface utilisateur en pseudo-code standard Flutter (Structure Widgets)
/// Conçu pour être hautement réactif même sur de petits écrans (Marché Africain)
class SalesPipelinePage {
  final SalesBloc bloc;

  SalesPipelinePage({required this.bloc});

  void renderUI() {
    print('--- 📱 RENDER: REM Sales Dashboard Mobile First ---');
    final currentState = bloc.state;

    if (currentState is SalesLoading) {
      print('[UI] Affichage du Loader circulaire d\'activité...');
    } else if (currentState is SalesSuccess) {
      print('[UI] Affichage du Pipeline de Ventes mis à jour :');
      for (var doc in currentState.documents) {
        print('  -> [${doc.type}] N°${doc.number} | Montant: ${doc.totalAmount} XOF | Statut: ${doc.status}');
      }
    } else if (currentState is SalesError) {
      print('[UI ERROR] Affichage de l\'alerte contextuelle: ${currentState.message}');
    }
    print('--------------------------------------------------\n');
  }
}
