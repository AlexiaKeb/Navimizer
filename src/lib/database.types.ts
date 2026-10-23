export interface Database {
  public: {
    Tables: {
      routes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          origin: string;
          destination: string;
          waypoints: string[];
          mode: 'car' | 'bike' | 'walk';
          distance: number;
          duration: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          origin: string;
          destination: string;
          waypoints?: string[];
          mode: 'car' | 'bike' | 'walk';
          distance: number;
          duration: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['routes']['Insert']>;
        Relationships: [];
      };
      shared_routes: {
        Row: { token: string; user_id: string; payload: unknown; created_at: string; expires_at: string };
        Insert: { user_id: string; payload: unknown; token?: string; created_at?: string; expires_at?: string };
        Update: Partial<{ payload: unknown; expires_at: string }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_shared_route: { Args: { p_token: string }; Returns: unknown };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
