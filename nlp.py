from flask import Flask, request, jsonify
import spacy

# Load the English language model
nlp = spacy.load("en_core_web_lg")

app = Flask(__name__)

# Set up PII detection
pii_entities = ["PERSON", "NORP", "ORG", "GPE", "LOC", "DATE", "TIME", "EVENT"]


@app.route('/scan', methods=['POST'])
def scan_data():
    data = request.json.get('data')
    doc = nlp(data)
    found = {}
    for ent in doc.ents:
        if ent.label_ in pii_entities:
            if ent.label_ not in found:
                found[ent.label_] = []
            found[ent.label_].append(ent.text)
    return jsonify(found)


if __name__ == '__main__':
    app.run()
