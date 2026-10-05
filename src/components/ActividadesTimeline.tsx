import { AlertTriangle, CircleDot, FileText, Mail, MapPin, MessageCircle, Monitor, NotebookPen, Phone, Truck, Users } from "lucide-react";

/*
 * Lo que queda de la línea de tiempo legacy: el ícono de cada tipo de actividad. Las filas las dibuja
 * `components/crm/cuenta/HistoriaCuenta.tsx` (`FilaActividad`) en las fichas de cuenta y en la de oportunidad.
 */

/** Ícono por el `codigo` estable de los tipos de sistema. Los tipos que crea el cliente (codigo null) usan el genérico. */
export const ICONO_POR_CODIGO: Record<string, React.ElementType> = {
  llamada: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  reunion: Users,
  reunion_virtual: Monitor,
  demostracion: Monitor,
  propuesta: FileText,
  visita_cancha: MapPin,
  entrega: Truck,
  queja: AlertTriangle,
  nota: NotebookPen,
  otro: CircleDot,
};
