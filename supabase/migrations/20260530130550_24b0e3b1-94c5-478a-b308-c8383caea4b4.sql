DROP TABLE IF EXISTS public._t2abis_results;
CREATE TABLE public._t2abis_results (
  seq serial primary key,
  test text,
  result text
);
GRANT SELECT ON public._t2abis_results TO service_role;

INSERT INTO public._t2abis_results(test, result)
SELECT test, result FROM public._t2abis_run_tests();

DROP FUNCTION IF EXISTS public._t2abis_run_tests();