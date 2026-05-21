import '../bloc/sales_bloc.dart';

class SalesPipelinePage {
  final SalesBloc bloc;
  SalesPipelinePage({required this.bloc});

  void renderUI() {
    print('--- 📱 RENDER: REM Sales Dashboard Mobile First ---');
    final currentState = bloc.state;

    if (currentState is SalesLoading) {
      print('[UI] Chargement réseau optimisé...');
    } else if (currentState is SalesSuccess) {
      print('[UI] Affichage du Pipeline de Ventes mis à jour :');
      for (var doc in currentState.documents) {
        print('  -> [${doc.type}] N°${doc.number} | Montant: ${doc.totalAmount} XOF | Statut: ${doc.status}');
      }
    } else if (currentState is SalesError) {
      print('[UI ERROR] Alerte contextuelle: ${currentState.message}');
    }
    print('--------------------------------------------------\n');
  }
}
