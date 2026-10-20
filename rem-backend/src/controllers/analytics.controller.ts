import { Request, Response } from 'express';
import { AnalyticsRepository } from '../repositories/analytics.repository';

export class AnalyticsController {
  constructor(private analyticsRepository: AnalyticsRepository) {}

  getProductAnalytics = async (req: Request, res: Response) => {
    try {
      // The company comes from the token only.
      const company_id = (req as any).user?.companyId;

      if (!company_id) {
        return res.status(400).json({ success: false, error: "Company ID manquant" });
      }

      const data = await this.analyticsRepository.getProductRevenueDistribution(company_id as string);
      
      // Toujours un succès HTTP 200 pour éviter de bloquer l'UX du tableau de bord
      return res.json({
        success: true,
        data: data
      });
    } catch (globalError: any) {
      console.error("❌ Erreur critique contrôleur :", globalError);
      return res.status(200).json({ success: true, data: [] });
    }
  };
}