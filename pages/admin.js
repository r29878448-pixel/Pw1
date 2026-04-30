import { useState, useEffect, useRef } from 'react';
import { getApiUrl, setApiUrl, getCustomBatches, addCustomBatch, removeCustomBatch, updateCustomBatch, getAllBatchesForEdit, saveBatchEdit } from '../lib/apiConfig';

export default function AdminPanel() {
  const [loading, setLoading] = useState(false);
  
  const [apiUrl, setApiUrlState] = useState('');
  const [customBatches, setCustomBatches] = useState([]);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [newBatch, setNewBatch] = useState({
    batchId: '',
    batchName: '',
    batchImage: '',
    _tag: ''
  });
  
  const hasLoadedData = useRef(false);
  
  // Default batches for editing
  const [defaultBatches] = useState([
    { batchId: '698ad3519549b300a5e1cc6a', batchName: 'Arjuna JEE 2027', batchImage: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/arjuna-jee-2027.png', _tag: 'JEE' },
    { batchId: '69897f0ad7c19b7b2f7cc35f', batchName: 'Arjuna NEET 2027', batchImage: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/arjuna-neet-2027.png', _tag: 'NEET' },
    { batchId: '699434fe5423bd3d67b049b6', batchName: 'UDAAN 2.0 2027 (Class 10th)', batchImage: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/udaan-2027.png', _tag: '10th' },
    { batchId: '67790151518b938bc630052d', batchName: 'Udaan 2027 (Class 10th)', batchImage: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/udaan-2027.png', _tag: '10th' },
  ]);
  
  const [batchEdits, setBatchEdits] = useState({});

  useEffect(() => {
    if (hasLoadedData.current) return;
    hasLoadedData.current = true;
    (async () => {
      try {
        const url = await getApiUrl();
        setApiUrlState(url || '');
        const batches = await getCustomBatches();
        setCustomBatches(batches);
        const edits = await getAllBatchesForEdit();
        setBatchEdits(edits);
      } catch (err) {
        console.error('[Admin] Load error:', err);
      }
    })();
  }, []);

  const handleSaveApiUrl = async () => {
    try {
      setLoading(true);
      await setApiUrl(apiUrl);
      alert('✅ API URL saved to Firebase successfully!');
    } catch (error) {
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBatch = async () => {
    try {
      setLoading(true);
      await addCustomBatch(newBatch);
      const batches = await getCustomBatches();
      setCustomBatches(batches);
      setNewBatch({ batchId: '', batchName: '', batchImage: '', _tag: '' });
      setShowAddBatch(false);
      alert('✅ Batch added successfully! All users can now see it.');
    } catch (error) {
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBatch = async (batchId) => {
    if (confirm('Are you sure you want to remove this batch? It will be removed for all users.')) {
      try {
        setLoading(true);
        await removeCustomBatch(batchId);
        const batches = await getCustomBatches();
        setCustomBatches(batches);
        alert('✅ Batch removed for all users!');
      } catch (error) {
        alert('❌ Error: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditBatch = async (batch) => {
    try {
      const batchEditsData = batchEdits[batch.batchId] || {};
      
      setEditingBatch({
        batchId: batch.batchId,
        batchName: batchEditsData.batchName || batch.batchName,
        batchImage: batchEditsData.batchImage || batch.batchImage,
        _tag: batchEditsData._tag || batch._tag,
        _isCustom: batch._custom || false
      });
    } catch (error) {
      console.error('Error loading batch edits:', error);
      alert('❌ Error loading batch data');
    }
  };

  const handleSaveEdit = async () => {
    try {
      setLoading(true);
      
      // Save edits to Firebase (works for both custom and default batches)
      await saveBatchEdit(editingBatch.batchId, {
        batchName: editingBatch.batchName,
        batchImage: editingBatch.batchImage,
        _tag: editingBatch._tag
      });
      
      // If it's a custom batch, also update the main batch document
      if (editingBatch._isCustom) {
        await updateCustomBatch(editingBatch.batchId, {
          batchName: editingBatch.batchName,
          batchImage: editingBatch.batchImage,
          _tag: editingBatch._tag
        });
        const batches = await getCustomBatches();
        setCustomBatches(batches);
      }
      
      // Reload batch edits
      const edits = await getAllBatchesForEdit();
      setBatchEdits(edits);
      
      setEditingBatch(null);
      alert('✅ Batch updated successfully! All users will see the changes.');
    } catch (error) {
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-white text-xl">
              ⚡
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">PW Admin Panel</h1>
              <p className="text-xs text-gray-500">Manage API & Batches</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* API Configuration */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🔌 API Configuration</h2>
          <p className="text-gray-600 text-sm mb-4">
            Set the base API URL. All API requests will use this URL.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Base URL
              </label>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrlState(e.target.value)}
                placeholder="https://your-api-server.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleSaveApiUrl}
              disabled={loading}
              className="bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save API URL to Firebase'}
            </button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2 text-sm">ℹ️ Required API Endpoints</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• <code>/api/pw/batches</code> - Get all batches</li>
              <li>• <code>/api/pw/batchdetails</code> - Get batch details</li>
              <li>• <code>/api/pw/topics</code> - Get topics</li>
              <li>• <code>/api/pw/datacontent</code> - Get content</li>
              <li>• <code>/api/pw/videonew</code> - Get video URL</li>
              <li>• <code>/api/pw/otp</code> - Get DRM keys</li>
            </ul>
          </div>
        </div>

        {/* Edit Batch Modal */}
        {editingBatch && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-gray-900 mb-4">✏️ Edit Batch</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Batch ID (Read-only)</label>
                  <input
                    type="text"
                    value={editingBatch.batchId}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Batch Name</label>
                  <input
                    type="text"
                    value={editingBatch.batchName}
                    onChange={(e) => setEditingBatch({ ...editingBatch, batchName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail URL</label>
                  <input
                    type="url"
                    value={editingBatch.batchImage}
                    onChange={(e) => setEditingBatch({ ...editingBatch, batchImage: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tag</label>
                  <input
                    type="text"
                    value={editingBatch._tag}
                    onChange={(e) => setEditingBatch({ ...editingBatch, _tag: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingBatch(null)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-400 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Default Batches - Edit Only */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">🎯 Default Batches</h2>
            <p className="text-gray-600 text-sm mt-1">
              Edit thumbnail and title of default batches
            </p>
          </div>

          <div className="space-y-3">
            {defaultBatches.map((batch) => {
              const batchEditsData = batchEdits[batch.batchId] || {};
              const displayName = batchEditsData.batchName || batch.batchName;
              const displayImage = batchEditsData.batchImage || batch.batchImage;
              const displayTag = batchEditsData._tag || batch._tag;
              
              return (
                <div
                  key={batch.batchId}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-orange-300 transition"
                >
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={displayName}
                      className="w-16 h-16 rounded-lg object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center text-2xl">
                      📚
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{displayName}</p>
                    <p className="text-sm text-gray-500">ID: {batch.batchId}</p>
                    {displayTag && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full font-medium">
                        {displayTag}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleEditBatch(batch)}
                    className="text-orange-600 hover:text-orange-700 font-medium text-sm"
                  >
                    ✏️ Edit
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Batches */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">📚 Custom Batches</h2>
              <p className="text-gray-600 text-sm mt-1">
                Add and manage custom batches
              </p>
            </div>
            <button
              onClick={() => setShowAddBatch(!showAddBatch)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition text-sm"
            >
              {showAddBatch ? 'Cancel' : '+ Add Batch'}
            </button>
          </div>

          {/* Add Batch Form */}
          {showAddBatch && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Add New Batch</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={newBatch.batchId}
                  onChange={(e) => setNewBatch({ ...newBatch, batchId: e.target.value })}
                  placeholder="Batch ID (required)"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <input
                  type="text"
                  value={newBatch.batchName}
                  onChange={(e) => setNewBatch({ ...newBatch, batchName: e.target.value })}
                  placeholder="Batch Name (required)"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <input
                  type="url"
                  value={newBatch.batchImage}
                  onChange={(e) => setNewBatch({ ...newBatch, batchImage: e.target.value })}
                  placeholder="Thumbnail URL (optional)"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <input
                  type="text"
                  value={newBatch._tag}
                  onChange={(e) => setNewBatch({ ...newBatch, _tag: e.target.value })}
                  placeholder="Tag (e.g., JEE, NEET)"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleAddBatch}
                className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
              >
                Add Batch
              </button>
            </div>
          )}

          {/* Batches List */}
          {customBatches.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-5xl mb-3">📭</div>
              <p>No custom batches added yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {customBatches.map((batch) => {
                const batchEditsData = batchEdits[batch.batchId] || {};
                const displayName = batchEditsData.batchName || batch.batchName;
                const displayImage = batchEditsData.batchImage || batch.batchImage;
                const displayTag = batchEditsData._tag || batch._tag;
                
                return (
                  <div
                    key={batch.batchId}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-orange-300 transition"
                  >
                    {displayImage ? (
                      <img
                        src={displayImage}
                        alt={displayName}
                        className="w-16 h-16 rounded-lg object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center text-2xl">
                        📚
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{displayName}</p>
                      <p className="text-sm text-gray-500">ID: {batch.batchId}</p>
                      {displayTag && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full font-medium">
                          {displayTag}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditBatch({ ...batch, _custom: true })}
                        className="text-orange-600 hover:text-orange-700 font-medium text-sm"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleRemoveBatch(batch.batchId)}
                        className="text-red-600 hover:text-red-700 font-medium text-sm"
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
