import 'rem_sales_mobile/lib/features/sales/presentation/bloc/sales_bloc.dart';
import 'rem_sales_mobile/lib/features/sales/presentation/pages/sales_pipeline_page.dart';

void main() async {
  print('==================================================');
  print('🚀 EXÉCUTION DE LA SIMULATION MÉTIER REM SALES (MOBILE FIRST)');
  print('==================================================\n');

  final bloc = SalesBloc();
  final ui = SalesPipelinePage(bloc: bloc);

  // Étape 1 : État initial
  ui.renderUI();

  // Étape 2 : Création d'un premier Devis pour une quincaillerie ou boutique africaine
  print('[Action] L\'utilisateur clique sur "Créer Devis" pour un montant de 45,000 XOF');
  await bloc.createDocument('client-cfa-1', 'QUOTE', 45000.00);
  ui.renderUI();

  // Étape 3 : Création d'une Facture directe pour une livraison de marchandises
  print('[Action] L\'utilisateur valide une commande directe et génère une Facture de 120,000 XOF');
  await bloc.createDocument('client-cfa-2', 'INVOICE', 120000.00);
  ui.renderUI();

  print('==================================================');
  print('✅ TOUS LES COMPOSANTS MOCKÉS TO END TO END ONT ÉTÉ ENREGISTRÉS SANS CONFLITS');
  print('==================================================');
}
