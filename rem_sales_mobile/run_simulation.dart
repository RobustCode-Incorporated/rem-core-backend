import 'dart:async';
import 'package:http/http.dart' as http;
import 'lib/features/sales/data/repositories/sales_repository.dart';
import 'lib/features/sales/data/repositories/client_repository.dart';

void main() async {
  print('==================================================');
  print('🚀 EXÉCUTION DE LA SIMULATION RÉSEAU REM SALES (LIVE)');
  print('==================================================\n');

  final httpClient = http.Client();
  final salesRepo = SalesRepository(client: httpClient);
  final clientRepo = ClientRepository(client: httpClient);

  try {
    print('--- 📱 RENDER: REM Sales Dashboard Mobile First ---');
    print('--------------------------------------------------');
    print('[Action Mobile] Inscription d\'un nouveau client terrain...');
    
    final newClient = await clientRepo.createClient(
      name: 'Modou Fall',
      email: 'modou.fall@tech.sn',
      phone: '+22171234567',
    );
    
    print('[UI SUCCESS] Client créé à la volée ! ID: ${newClient.id}');
    print('--------------------------------------------------\n');

    print('[Action Mobile] Tentative de création d\'un Devis de 45,000 XOF...');
    final quote = await salesRepo.sendDocumentToBackend(
      clientId: newClient.id,
      type: 'QUOTE',
      amount: 45000.0,
    );

    print('--- 📱 RENDER: REM Sales Dashboard Mobile First ---');
    print('[UI] Affichage du Pipeline de Ventes mis à jour :');
    print('  -> [${quote.type}] N°${quote.number} | Montant: ${quote.totalAmount} XOF | Statut: ${quote.status}');
    print('--------------------------------------------------\n');

    print('[Action Mobile] Tentative de création d\'une Facture de 120,000 XOF...');
    final invoice = await salesRepo.sendDocumentToBackend(
      clientId: newClient.id,
      type: 'INVOICE',
      amount: 120000.0,
    );

    print('--- 📱 RENDER: REM Sales Dashboard Mobile First ---');
    print('[UI] Affichage du Pipeline de Ventes mis à jour (Avant Encaissement) :');
    print('  -> [${invoice.type}] N°${invoice.number} | Montant: ${invoice.totalAmount} XOF | Statut: ${invoice.status}');
    print('--------------------------------------------------\n');

    // ==================================================
    // 🎯 INTEGRATION REM-205 : ENCAISSEMENT EN DIRECT
    // ==================================================
    print('[Action Mobile] 💵 Client sort le cash ! Traitement de l\'encaissement...');
    
    final paymentSuccess = await salesRepo.updateDocumentStatus(
      documentId: invoice.id, 
      newStatus: 'PAID',
    );

    if (paymentSuccess) {
      print('\n--- 📱 RENDER: REM Sales Dashboard Mobile First ---');
      print('[UI SUCCESS] 🎉 Paiement validé ! Statut mis à jour en Base de données.');
      print('  -> [INVOICE] N°${invoice.number} | Montant: ${invoice.totalAmount} XOF | Statut: PAID 🟢');
    }
    print('--------------------------------------------------\n');

  } catch (e) {
    print('--- 📱 RENDER: REM Sales Dashboard Mobile First ---');
    print('[UI ERROR] Alerte contextuelle: $e');
    print('--------------------------------------------------\n');
  } finally {
    httpClient.close();
    print('==================================================');
    print('✅ FIN DE LA SIMULATION RÉSEAU END-TO-END');
    print('==================================================');
  }
}