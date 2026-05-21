import { redirect } from 'next/navigation';

export default function SalesLogsRedirect() {
  redirect('/audit?vertical=sales_marketing');
}
