import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:rem_sales_mobile/features/sales/presentation/bloc/sales_bloc.dart';
import 'package:rem_sales_mobile/features/sales/presentation/bloc/sales_event.dart';
import 'package:rem_sales_mobile/features/sales/presentation/bloc/sales_state.dart';
import 'package:rem_sales_mobile/features/sales/data/models/sales_document_model.dart'; 
import 'package:rem_sales_mobile/features/sales/data/models/product_model.dart'; // 📦 Import du modèle de produit Isar

class SalesScreen extends StatefulWidget {
  const SalesScreen({super.key});

  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends State<SalesScreen> {
  final List<String> _currencies = ['XOF', 'USD', 'EUR', 'CAD'];
  late String _selectedCurrency;

  // 🛒 PANIER DYNAMIQUE : Remplace les mocks statiques
  final List<Map<String, dynamic>> _dynamicCartItems = [];

  // 🛡️ MULTI-TENANT LOCAL : Pour simuler l'entreprise du commercial connecté (ex: Robust Capital Africa)
  final String _currentCompanyId = 'robust-corp-africa-123';

  @override
  void initState() {
    super.initState();
    _selectedCurrency = _currencies[0];

    // 🚀 BOOT : On demande au BLoC de charger immédiatement le catalogue d'articles Isar de cette entreprise
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SalesBloc>().add(LoadProductsEvent(_currentCompanyId));
    });
  }

  double _calculateTotal() {
    return _dynamicCartItems.fold(0, (sum, item) => sum + (item['price'] * item['quantity']));
  }

  // 📥 Logique métier d'ajout au panier
  void _addProductToCart(ProductModel product) {
    setState(() {
      final existingIndex = _dynamicCartItems.indexWhere((item) => item['serverId'] == product.serverId || item['name'] == product.name);
      if (existingIndex >= 0) {
        _dynamicCartItems[existingIndex]['quantity'] += 1;
      } else {
        _dynamicCartItems.add({
          'serverId': product.serverId,
          'name': product.name,
          'price': product.sellingPrice,
          'quantity': 1,
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final totalAmount = _calculateTotal();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Caisse & Catalogue REM'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
      ),
      body: BlocListener<SalesBloc, SalesState>(
        listener: (context, state) {
          if (state is SalesSuccess) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('🎉 Vente enregistrée avec succès en local (Isar) !'),
                backgroundColor: Colors.green,
              ),
            );
            // On vide le panier après encaissement réussi
            setState(() {
              _dynamicCartItems.clear();
            });
          } else if (state is SalesError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('⚠️ Notification : ${state.message}'),
                backgroundColor: Colors.orange,
              ),
            );
          }
        },
        child: Column(
          children: [
            // 🌐 SECTION 1 : Sélecteur de Devise
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Card(
                elevation: 2,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.payments_outlined, color: Colors.indigo),
                          SizedBox(width: 8),
                          Text('Devise :', style: TextStyle(fontWeight: FontWeight.bold)),
                        ],
                      ),
                      DropdownButton<String>(
                        value: _selectedCurrency,
                        items: _currencies.map((String currency) {
                          return DropdownMenuItem<String>(
                            value: currency,
                            child: Text(currency, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.indigo)),
                          );
                        }).toList(),
                        onChanged: (String? newValue) {
                          if (newValue != null) {
                            setState(() {
                              _selectedCurrency = newValue;
                            });
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // 📦 SECTION 2 : Le Catalogue Dynamique (Isar DB)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 14.0, vertical: 4),
              child: Row(
                children: [
                  Icon(Icons.storefront, color: Colors.orange, size: 20),
                  SizedBox(width: 6),
                  Text('Catalogue d\'Articles', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            
            SizedBox(
              height: 125, // Un poil plus grand pour laisser respirer l'UI suite à l'agencement vertical
              child: BlocBuilder<SalesBloc, SalesState>(
                buildWhen: (previous, current) => current is ProductsLoading || current is ProductsLoadSuccess,
                builder: (context, state) {
                  if (state is ProductsLoading) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  
                  if (state is ProductsLoadSuccess) {
                    final products = state.products;
                    if (products.isEmpty) {
                      return const Center(child: Text('Aucun article dans le catalogue local.'));
                    }

                    return ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      itemCount: products.length,
                      itemBuilder: (context, index) {
                        final product = products[index];
                        return GestureDetector(
                          onTap: () => _addProductToCart(product),
                          child: Container(
                            width: 155,
                            margin: const EdgeInsets.only(right: 10, bottom: 8, top: 4),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, spreadRadius: 1)],
                              border: Border.all(color: Colors.indigo.withOpacity(0.1)),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(8.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    product.name,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                  ),
                                  // 🛡️ DESIGN ADAPTATIF ANTI-OVERFLOW : Agencement vertical pour isoler le prix du stock
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${product.sellingPrice.toInt()} $_selectedCurrency', 
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 13)
                                      ),
                                      const SizedBox(height: 2),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: Colors.orange.withOpacity(0.1), 
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          'Stock: ${product.stockQuantity}', 
                                          style: const TextStyle(fontSize: 9, color: Colors.orange, fontWeight: FontWeight.bold)
                                        ),
                                      )
                                    ],
                                  )
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    );
                  }
                  return const Center(child: Text('Prêt à charger le catalogue...'));
                },
              ),
            ),

            // 🛒 SECTION 3 : Le Panier Courant (Calculé dynamiquement)
            Expanded(
              child: Card(
                margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                elevation: 4,
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '🛒 Panier Actuel ($_selectedCurrency)',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.indigo),
                      ),
                      const Divider(),
                      Expanded(
                        child: _dynamicCartItems.isEmpty
                            ? const Center(child: Text('Le panier est vide. Tapez sur un article du catalogue !', style: TextStyle(color: Colors.grey)))
                            : ListView.builder(
                                itemCount: _dynamicCartItems.length,
                                itemBuilder: (context, index) {
                                  final item = _dynamicCartItems[index];
                                  return ListTile(
                                    leading: const Icon(Icons.shopping_bag_outlined, color: Colors.indigo),
                                    title: Text(item['name']),
                                    subtitle: Text('${item['quantity']} x ${item['price']} $_selectedCurrency'),
                                    trailing: Text(
                                      '${item['quantity'] * item['price']} $_selectedCurrency',
                                      style: const TextStyle(fontWeight: FontWeight.bold),
                                    ),
                                  );
                                },
                              ),
                      ),
                      const Divider(),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('NET À PAYER :', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                            Text(
                              '$totalAmount $_selectedCurrency',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.green),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // 💳 SECTION 4 : Bouton de Validation / Encaissement
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: BlocBuilder<SalesBloc, SalesState>(
                buildWhen: (previous, current) => current is SalesLoading || current is SalesSuccess || current is SalesError,
                builder: (context, state) {
                  if (state is SalesLoading) {
                    return ElevatedButton(
                      onPressed: null,
                      style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                      child: const CircularProgressIndicator(),
                    );
                  }

                  return ElevatedButton.icon(
                    icon: const Icon(Icons.monetization_on),
                    label: const Text('ENCAISSER & SYNC (OFFLINE-FIRST)', style: TextStyle(fontSize: 16)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(54),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: _dynamicCartItems.isEmpty ? null : () {
                      final uniqueDocNumber = 'FACT-${DateTime.now().millisecondsSinceEpoch}';
                      
                      final newDocument = SalesDocument(
                        id: 'mob-uuid-${DateTime.now().microsecondsSinceEpoch}',
                        type: 'INVOICE',
                        number: uniqueDocNumber,
                        status: 'DRAFT',
                        totalAmount: totalAmount,
                        createdAt: DateTime.now(),
                      );

                      context.read<SalesBloc>().add(SaveDocumentEvent(newDocument));
                    },
                  );
                },
              ),
            ),
            const SizedBox(height: 5),
          ],
        ),
      ),
    );
  }
}