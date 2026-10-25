"""Retired Cloud Run compatibility service. The local backend has no Google dependencies.

This source change does not disable an image that is already deployed. Cloud owners
must remove its invoker access or redeploy the retirement image separately.
"""
import os
from flask import Flask, jsonify

app = Flask(__name__)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'retired'}), 200


@app.route('/upscale', methods=['POST'])
def upscale():
    return jsonify({'error': 'Legacy upscaler retired. Use the FormLab generation API.'}), 410


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', 8080)), debug=False)
