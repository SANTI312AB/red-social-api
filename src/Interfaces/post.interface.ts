

// Define la estructura para un 'hotspot' en una imagen/video del post
export interface Hotspot {
  id: any;
  descripcion: string;
  coordX: number;
  coordY: number;
  username: string | null; // Aquí se envía el username del producto etiquetado
}

// Define la estructura para un elemento multimedia (imagen o video) dentro de un post
export interface MultimediaContent {
  id: any;
  archivo: string | null;
  thumb: string | null;
  descripcion: string | null;
  orden: number;
  tipo: string | null;
  hotpots: Hotspot[] | null;
}

// Define la estructura para el conteo de reacciones en un post
export interface ReactionCount {
  tipo: string;
  cantidad: number;
}

// Define la estructura para los datos del usuario que creó el post
export interface PostUser {
  avatar: string;
  username: string;
  nombre: string;
  apellido: string | null;
  verificado: boolean;
}

export interface PostTags{
  id: number;
  nombre: string;
}

// Define la estructura del estado de visualización del usuario autenticado
export interface PostViewState {
  es_propio: boolean;
  siguiendo: boolean;
  reaccionado: boolean;
  id_reaccion: number | null;
  tipo_reaccion: string | null;
}

// La interfaz principal que define el objeto de respuesta completo para un post
export interface PostProfile {
  id: any;
  slug:string;
  usuario: PostUser;
  descripcion: string;
  contenido: MultimediaContent[];
  fecha_creacion: Date;
  fecha_edicion: Date | null;
  total_comentarios: number;
  reacciones: ReactionCount[];
  etiquetas:PostTags[];
  viewState: PostViewState | null;
}


