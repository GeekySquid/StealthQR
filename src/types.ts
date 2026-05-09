export type ShareRecord = {
  id: string;
  file_path: string;
  file_name: string;
  size: number;
  content_type: string;
  created_at?: string;
  password_hash?: string | null;
};
