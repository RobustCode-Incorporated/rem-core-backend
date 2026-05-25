import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:rem_sales_mobile/features/sales/presentation/bloc/sales_bloc.dart';
import 'package:rem_sales_mobile/features/sales/presentation/bloc/sales_event.dart';
import 'package:rem_sales_mobile/features/sales/presentation/bloc/sales_state.dart';
import 'package:rem_sales_mobile/features/sales/presentation/pages/sales_screen_page.dart';
import 'package:rem_sales_mobile/features/sales/data/models/product_model.dart';

// 🛡️ CORRECTION MOCKTAIL : Création d'un Fake pour permettre l'utilisation de `any()` sur les événements
class FakeSalesEvent extends Fake implements SalesEvent {}
class MockSalesBloc extends MockBloc<SalesEvent, SalesState> implements SalesBloc {}

void main() {
  late MockSalesBloc mockSalesBloc;

  final dummyProducts = [
    ProductModel(
      companyId: 'robust-corp-africa-123',
      name: 'Sac de Ciment 50kg',
      purchasePrice: 3500.0,
      sellingPrice: 4500.0,
      stockQuantity: 150,
      code: 'CIM-50K',
    ),
  ];

  // S'exécute une seule fois avant le lancement de tous les tests
  setUpAll(() {
    registerFallbackValue(FakeSalesEvent());
  });

  setUp(() {
    mockSalesBloc = MockSalesBloc();
  });

  testWidgets('📱 [UI TEST] Le panier affiche la devise sélectionnée et émet l\'événement d\'encaissement', (WidgetTester tester) async {
    when(() => mockSalesBloc.state).thenReturn(ProductsLoadSuccess(dummyProducts));

    await tester.pumpWidget(
      MaterialApp(
        home: BlocProvider<SalesBloc>.value(
          value: mockSalesBloc,
          child: const SalesScreen(),
        ),
      ),
    );

    print('--- 🧪 START: Test de l\'interface de caisse et multi-devise ---');
    await tester.pumpAndSettle();

    expect(find.text('Sac de Ciment 50kg'), findsOneWidget);
    print('✅ [UI] Catalogue chargé dynamiquement avec succès depuis Isar.');

    await tester.tap(find.text('Sac de Ciment 50kg'));
    await tester.pumpAndSettle();

    expect(find.text('1 x 4500.0 XOF'), findsOneWidget);
    print('✅ [UI] Panier mis à jour dynamiquement après clic sur le catalogue.');

    final dropdownFinder = find.byType(DropdownButton<String>);
    expect(dropdownFinder, findsOneWidget);

    await tester.tap(dropdownFinder);
    await tester.pumpAndSettle();

    final usdItemFinder = find.text('USD').last;
    await tester.tap(usdItemFinder);
    await tester.pumpAndSettle();

    expect(find.text('🛒 Panier Actuel (USD)'), findsOneWidget);
    print('✅ [UI] Sélecteur dynamique validé : Le panier s\'est mis à jour en (USD) !');

    final checkoutButtonFinder = find.byType(ElevatedButton);
    expect(checkoutButtonFinder, findsOneWidget);

    await tester.tap(checkoutButtonFinder);
    await tester.pump();

    verify(() => mockSalesBloc.add(any(that: isA<SaveDocumentEvent>()))).called(1);
    print('✅ [UI] Bouton Encaisser validé : L\'événement d\'enregistrement offline a bien été envoyé au BLoC !');
    print('------------------------------------------------------------------');
  });
}