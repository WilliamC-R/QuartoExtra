export type UserRole = "gestor" | "cliente";
export type ImovelStatus = "ativo" | "manutencao" | "bloqueado";
export type ModalidadeAluguel = "diaria" | "mensal";

export interface Profile {
  user_id: string;
  role: UserRole;
  nome_completo: string;
  created_at?: string;
  updated_at?: string;
}

export interface Imovel {
  id: string;
  user_id: string;
  matricula: string;
  cliente_id?: string | null;
  estado: string;
  cidade: string;
  bairro: string;
  predio: string;
  unidade: string;
  valor_imovel: number;
  tipo: string;
  modalidade_aluguel: ModalidadeAluguel;
  diaria: number;
  cap: number;
  status: ImovelStatus;
  obs: string;
  custo_condominio: number;
  custo_energia: number;
  custo_internet: number;
  custo_limpeza: number;
  repasse_condominio: number;
  repasse_energia: number;
  repasse_internet: number;
  repasse_limpeza: number;
  iptu_anual: number;
  repasse_iptu_anual: number;
  itbi: number;
  qtd_garagens: number;
  created_at?: string;
  updated_at?: string;
}

export type GaragemStatus = "livre" | "ocupada" | "bloqueada";

export interface Garagem {
  id: string;
  user_id: string;
  estado: string;
  cidade: string;
  predio: string;
  codigo: string;
  status: GaragemStatus;
  obs: string;
  created_at?: string;
}

export interface Reserva {
  id: string;
  user_id: string;
  imovel_id: string;
  hospede: string;
  checkin: string;
  checkout: string;
  valor: number;
  origem: string;
  obs: string;
  precisa_garagem: boolean;
  garagem_id: string | null;
  custo_limpeza: number;
  custo_energia: number;
  custo_outros: number;
  gmail_message_id?: string | null;
  created_at?: string;
}

export interface AppData {
  imoveis: Imovel[];
  reservas: Reserva[];
  garagens: Garagem[];
  profile: Profile | null;
}

export interface MesAno {
  m: number;
  y: number;
}
