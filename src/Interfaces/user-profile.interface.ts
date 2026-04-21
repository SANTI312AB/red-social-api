/**
 * Define la estructura de los datos públicos del perfil de un usuario.
 * Esto asegura que siempre devolvamos los mismos campos de manera consistente.
 */
export interface UserProfile {
  email: string | null ;
  username: string| null;
  nombre: string| null;
  apellido: string | null;
  celular: string | null;
  tipo_documento: string | null;
  dni: string | null;
  genero: string | null;
  fecha_registro: Date | null; // Se usará el formato ISO 8601 (ej: "2023-10-27T10:00:00.000Z")
  fecha_nacimiento: Date | null;
  avatar: string| null; // URL completa
  verificacion_email: string | null;
  requiere_biometrico: boolean;
  verificacion_biometrico: string | null;
  has_verified: boolean;
  intentos_biometrico: number | null;
  minimum_purchase_amount: number | null;
  seguidores?: number;
  seguidos?: number;
  posts?: number;
  
  siguiendo?: boolean;
  public_profile?:boolean;
  notificaciones_push?:boolean;
  notificaciones_email?:boolean;
}
