import argparse, json, re
REQUIRED={"datasheet":["Motivation","Composition","Collection Process","Preprocessing","Uses","Distribution","Maintenance"],"model_card":["Model Details","Intended Use","Factors","Metrics","Evaluation Data","Training Data","Ethical Considerations"],"data_card":["Dataset Summary","Languages","Data Fields","Data Splits","Dataset Creation","Considerations"]}
PII={"email":r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}","ssn":r"\b\d{3}-\d{2}-\d{4}\b","ip":r"\b(?:\d{1,3}\.){3}\d{1,3}\b","phone":r"\b\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"}
def validate(text, kind="datasheet"):
    missing=[s for s in REQUIRED[kind] if not re.search(rf"^#{{1,3}}\s+{re.escape(s)}\b", text, re.I|re.M)]
    warnings=[{"pattern":k,"match":m.group(0)} for k,p in PII.items() for m in re.finditer(p,text,re.I)]
    return {"ok": not missing, "missing": missing, "piiWarnings": warnings}
def main(argv=None):
    p=argparse.ArgumentParser(); p.add_argument('path'); p.add_argument('--kind', default='datasheet', choices=list(REQUIRED)); args=p.parse_args(argv)
    result=validate(open(args.path).read(), args.kind); print(json.dumps(result, indent=2)); return 0 if result['ok'] else 1
