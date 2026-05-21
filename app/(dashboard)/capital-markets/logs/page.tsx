import { redirect } from 'next/navigation';

export default function CMLogsRedirect() {
  redirect('/audit?vertical=capital_markets');
}
