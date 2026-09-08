export interface AuthUser {
  id: string;
  shop_id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface AuthShop {
  id: string;
  name: string;
  owner_name: string | null;
  contact_number: string | null;
  address: string | null;
  currency: string;
  rush_fee_centavos: number;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: AuthUser;
    shop: AuthShop;
    token: string;
  };
}

export interface ShopMeResponse {
  success: boolean;
  data: {
    shop: AuthShop;
  };
}
