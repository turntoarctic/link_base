/** 路由级加载态（chunk 拉取/查询期间），替代整页空白 */
import { Spinner } from "@/components/ui/spinner";
export function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-[13px] text-muted-foreground">
      <Spinner />
    </div>
  );
}
