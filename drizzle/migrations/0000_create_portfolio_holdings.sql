CREATE TABLE public.stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  stock_name text NOT NULL,
  buy_date date NOT NULL DEFAULT current_date,
  buy_price numeric(12,4) NOT NULL CHECK (buy_price > 0),
  buy_stocks numeric(14,4) NOT NULL CHECK (buy_stocks > 0),
  invested_amount numeric(16,2) NOT NULL CHECK (invested_amount > 0),
  sell_prediction_price numeric(12,4),
  sell_predictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stocks TO authenticated;
GRANT ALL ON public.stocks TO service_role;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own stocks" ON public.stocks FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users add own stocks" ON public.stocks FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users edit own stocks" ON public.stocks FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users remove own stocks" ON public.stocks FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
CREATE INDEX stocks_user_created_idx ON public.stocks(user_id, created_at DESC);