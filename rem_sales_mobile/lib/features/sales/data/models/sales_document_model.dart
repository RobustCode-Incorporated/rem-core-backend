class SalesDocument {
  final String id;
  final String type;
  final String number;
  final String status;
  final double totalAmount;
  final DateTime createdAt;

  SalesDocument({
    required this.id,
    required this.type,
    required this.number,
    required this.status,
    required this.totalAmount,
    required this.createdAt,
  });

  factory SalesDocument.fromJson(Map<String, dynamic> json) {
    // Parsing ultra-robuste pour parer aux chaînes de caractères renvoyées par PostgreSQL (Numeric/Decimal)
    final rawAmount = json['total_amount'];
    double parsedAmount = 0.0;
    
    if (rawAmount is num) {
      parsedAmount = rawAmount.toDouble();
    } else if (rawAmount is String) {
      parsedAmount = double.tryParse(rawAmount) ?? 0.0;
    }

    return SalesDocument(
      id: json['id'] as String,
      type: json['type'] as String,
      number: json['number'] as String,
      status: json['status'] as String,
      totalAmount: parsedAmount,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type,
      'number': number,
      'status': status,
      'total_amount': totalAmount,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
