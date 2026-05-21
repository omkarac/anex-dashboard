import { redirect } from 'next/navigation';

export default function SMLogsRedirect() {
  redirect('/audit?vertical=sales_marketing');
}
