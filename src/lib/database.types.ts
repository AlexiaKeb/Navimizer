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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
