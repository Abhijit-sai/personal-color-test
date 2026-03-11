import { supabaseAdmin } from './supabaseAdmin';

export interface TrackingLog {
    status: 'success' | 'failed';
    model_version?: string;
    error_message?: string;
    metadata?: Record<string, any>;
    image_id?: string;
}

export async function logAnalysisRun(log: TrackingLog) {
    try {
        const { error } = await supabaseAdmin
            .from('tracking_logs')
            .insert([
                {
                    status: log.status,
                    model_version: log.model_version || 'v1',
                    error_message: log.error_message,
                    metadata: log.metadata,
                    image_id: log.image_id,
                },
            ]);

        if (error) {
            console.error('Failed to log analysis run:', error);
        } else {
            console.log('Analysis run logged to Supabase');
        }
    } catch (err) {
        console.error('Unexpected error logging analysis run:', err);
    }
}
