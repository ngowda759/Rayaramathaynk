export interface TempleSettings {
  name: string;
  subtitle: string;
  logo: string;

  status: {
    isOpen: boolean;
    message: string;
  };

  contact: {
    phone: string;
    email: string;
  };

  address: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };

  location: {
    googleMaps: string;
  };
}
