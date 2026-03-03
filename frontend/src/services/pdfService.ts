import { fermentationApi } from "./api";
import { harvestApi } from './api';

export const pdfService = {
  async downloadHarvestPDF(harvestId: string): Promise<void> {
    try {
      const response = await harvestApi.get(`/harvests/${harvestId}/pdf`, {
        responseType: 'blob', 
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `harvest_report_${harvestId.substring(0, 8)}.pdf`;

      document.body.appendChild(link);
      link.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download harvest PDF:', error);
      throw error;
    }
  },

  async downloadBatchPDF(batchId: string): Promise<void> {
    try {
      const response = await fermentationApi.get(`/batches/${batchId}/pdf`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `batch_report_${batchId.substring(0, 8)}.pdf`;

      document.body.appendChild(link);
      link.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download batch PDF:', error);
      throw error;
    }
  },
};