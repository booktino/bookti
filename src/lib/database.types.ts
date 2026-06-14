export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      salons: {
        Row: {
          id: string
          owner_id: string
          name: string
          slug: string
          description: string | null
          phone: string | null
          email: string | null
          address: string | null
          city: string
          country: string
          logo_url: string | null
          cover_url: string | null
          currency: string
          timezone: string
          booking_notice_hours: number
          cancellation_allowed: boolean
          cancellation_hours: number
          cancellation_reason_required: boolean
          cancellation_fee_enabled: boolean
          cancellation_refund_hours: number
          cancellation_fee_type: 'percent_50' | 'percent_100' | 'fixed' | null
          cancellation_fee_amount: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          plan: 'trial' | 'pro' | 'cancelled'
          trial_ends_at: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['salons']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['salons']['Insert']>
      }
      staff: {
        Row: {
          id: string
          salon_id: string
          name: string
          title: string | null
          phone: string | null
          email: string | null
          avatar_url: string | null
          bio: string | null
          color: string
          display_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['staff']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['staff']['Insert']>
      }
      services: {
        Row: {
          id: string
          salon_id: string
          name: string
          description: string | null
          duration_min: number
          price_nok: number
          category: string | null
          color: string
          display_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['services']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['services']['Insert']>
      }
      bookings: {
        Row: {
          id: string
          salon_id: string
          staff_id: string | null
          service_id: string | null
          client_name: string
          client_phone: string
          client_email: string | null
          client_notes: string | null
          starts_at: string
          ends_at: string
          price_nok: number | null
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          sms_confirmation_sent: boolean
          sms_reminder_sent: boolean
          cancellation_reason: string | null
          refund_status: 'full' | 'partial' | 'none' | 'pending' | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['bookings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>
      }
      availability: {
        Row: {
          id: string
          staff_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['availability']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['availability']['Insert']>
      }
      sms_logs: {
        Row: {
          id: string
          booking_id: string
          salon_id: string
          phone: string
          message: string
          type: 'confirmation' | 'reminder' | 'cancellation' | 'custom'
          status: 'pending' | 'sent' | 'failed'
          twilio_sid: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['sms_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['sms_logs']['Insert']>
      }
      invoices: {
        Row: {
          id: string
          booking_id: string
          invoice_number: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
      }
    }
  }
}
